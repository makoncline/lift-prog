import ExpoModulesCore
import ActivityKit
import HealthKit
import UserNotifications
import WatchConnectivity

private let onUnfinishedWorkoutReminder = "onUnfinishedWorkoutReminder"
private let onWatchWorkoutCommand = "onWatchWorkoutCommand"
private let restTimerNotificationPrefix = "lift-prog-rest-"
private let restTimerNotificationIdentifier = "lift-prog-rest-current"
private let unfinishedWorkoutNotificationPrefix = "lift-prog-unfinished-"
private let unfinishedWorkoutNotificationIdentifier = "lift-prog-unfinished-current"

@available(iOS 16.2, *)
private struct LiftRestTimerAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var startedAt: Date
    var endsAt: Date
    var title: String
  }

  var name: String
}

private final class LiftHealthNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
  var onUnfinishedWorkoutReminder: (() -> Void)?

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .sound])
    } else {
      completionHandler([.alert, .sound])
    }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    if response.notification.request.identifier.hasPrefix(unfinishedWorkoutNotificationPrefix) {
      DispatchQueue.main.async { [weak self] in
        self?.onUnfinishedWorkoutReminder?()
      }
    }

    completionHandler()
  }
}

private final class LiftWatchConnectivityBridge: NSObject, WCSessionDelegate {
  static let shared = LiftWatchConnectivityBridge()

  private var session: WCSession?
  private var latestContext: [String: Any]?
  private var lastQueuedSnapshotSignature: String?
  var onCommand: (([String: Any]) -> Void)?

  private override init() {
    super.init()
  }

  func update(snapshot: [String: Any]) -> [String: Any] {
    guard let session = activeSession() else {
      return [
        "sent": false,
        "message": "WatchConnectivity is not available on this device."
      ]
    }

    let context = sanitizedApplicationContext(from: snapshot)
    latestContext = context

    guard session.activationState == .activated else {
      session.activate()
      return [
        "sent": false,
        "reachable": false,
        "message": "WatchConnectivity is activating."
      ]
    }

    guard session.isPaired else {
      return [
        "sent": false,
        "reachable": false,
        "message": "No paired Apple Watch was found."
      ]
    }

    return send(context: context, session: session)
  }

  func clear() -> [String: Any] {
    update(snapshot: [
      "isActive": false,
      "updatedAt": ISO8601DateFormatter().string(from: Date())
    ])
  }

  @discardableResult
  private func send(context: [String: Any], session: WCSession) -> [String: Any] {
    do {
      try session.updateApplicationContext(context)
      if session.isReachable {
        session.sendMessage(context, replyHandler: nil) { [weak self] _ in
          self?.queueSnapshotContextIfNeeded(context, session: session)
        }
      } else {
        queueSnapshotContextIfNeeded(context, session: session)
      }

      return [
        "sent": true,
        "reachable": session.isReachable,
        "message": NSNull()
      ]
    } catch {
      return [
        "sent": false,
        "reachable": session.isReachable,
        "message": error.localizedDescription
      ]
    }
  }

  private func queueSnapshotContextIfNeeded(_ context: [String: Any], session: WCSession) {
    let signature = snapshotQueueSignature(context)
    guard signature != lastQueuedSnapshotSignature else {
      return
    }

    lastQueuedSnapshotSignature = signature
    session.transferUserInfo(context)
  }

  private func snapshotQueueSignature(_ context: [String: Any]) -> String {
    let keys = [
      "isActive",
      "workoutName",
      "exerciseName",
      "setId",
      "setLabel",
      "setText",
      "setWeight",
      "setReps",
      "setWeightModifier",
      "setCompleted",
      "restTimerRunning",
      "restTimerDurationSeconds",
      "previousSet",
      "nextSet",
      "previousExercise",
      "nextExercise"
    ]

    return keys
      .map { key in "\(key)=\(context[key] ?? NSNull())" }
      .joined(separator: "|")
  }

  private func activeSession() -> WCSession? {
    guard WCSession.isSupported() else {
      return nil
    }

    if let session {
      if session.activationState == .notActivated {
        session.activate()
      }
      return session
    }

    let nextSession = WCSession.default
    nextSession.delegate = self
    nextSession.activate()
    session = nextSession
    return nextSession
  }

  private func sanitizedApplicationContext(from snapshot: [String: Any]) -> [String: Any] {
    var context: [String: Any] = [
      "workoutName": snapshot["workoutName"] as? String ?? "",
      "exerciseName": snapshot["exerciseName"] as? String ?? "",
      "setLabel": snapshot["setLabel"] as? String ?? "",
      "setText": snapshot["setText"] as? String ?? "",
      "setCompleted": boolPayloadValue(snapshot["setCompleted"]),
      "restText": snapshot["restText"] as? String ?? "",
      "restTimerRunning": boolPayloadValue(snapshot["restTimerRunning"]),
      "isActive": boolPayloadValue(snapshot["isActive"]),
      "updatedAt": snapshot["updatedAt"] as? String ?? ISO8601DateFormatter().string(from: Date())
    ]

    if let setId = snapshot["setId"] as? String, !setId.isEmpty {
      context["setId"] = setId
    }
    if let setWeightModifier = snapshot["setWeightModifier"] as? String, !setWeightModifier.isEmpty {
      context["setWeightModifier"] = setWeightModifier
    }
    if let setWeight = numericPayloadValue(snapshot["setWeight"]) {
      context["setWeight"] = setWeight
    }
    if let setReps = numericPayloadValue(snapshot["setReps"]) {
      context["setReps"] = setReps
    }
    if let remainingSeconds = numericPayloadValue(snapshot["restTimerRemainingSeconds"]) {
      context["restTimerRemainingSeconds"] = remainingSeconds
    }
    if let durationSeconds = numericPayloadValue(snapshot["restTimerDurationSeconds"]) {
      context["restTimerDurationSeconds"] = durationSeconds
    }
    if let restTimerEndsAt = snapshot["restTimerEndsAt"] as? String, !restTimerEndsAt.isEmpty {
      context["restTimerEndsAt"] = restTimerEndsAt
    }
    for key in ["previousSet", "nextSet", "previousExercise", "nextExercise"] {
      if let item = sanitizedWatchWorkoutItem(from: snapshot[key]) {
        context[key] = item
      }
    }

    return context
  }

  private func sanitizedWatchWorkoutItem(from value: Any?) -> [String: Any]? {
    guard let snapshot = value as? [String: Any] else { return nil }

    var item: [String: Any] = [
      "exerciseName": snapshot["exerciseName"] as? String ?? "",
      "setLabel": snapshot["setLabel"] as? String ?? "",
      "setText": snapshot["setText"] as? String ?? "",
      "setCompleted": boolPayloadValue(snapshot["setCompleted"])
    ]

    if let setId = snapshot["setId"] as? String, !setId.isEmpty {
      item["setId"] = setId
    }
    if let modifier = snapshot["setWeightModifier"] as? String, !modifier.isEmpty {
      item["setWeightModifier"] = modifier
    }
    if let weight = numericPayloadValue(snapshot["setWeight"]) {
      item["setWeight"] = weight
    }
    if let reps = numericPayloadValue(snapshot["setReps"]) {
      item["setReps"] = reps
    }

    return item
  }

  private func boolPayloadValue(_ value: Any?) -> Bool {
    if let value = value as? Bool {
      return value
    }

    if let value = value as? NSNumber {
      return value.boolValue
    }

    if let value = value as? String {
      switch value.lowercased() {
      case "true", "1", "yes":
        return true
      default:
        return false
      }
    }

    return false
  }

  private func numericPayloadValue(_ value: Any?) -> Double? {
    if value == nil || value is NSNull {
      return nil
    }

    if let number = value as? NSNumber {
      return number.doubleValue
    }

    if let value = value as? Double {
      return value
    }

    if let value = value as? Int {
      return Double(value)
    }

    return nil
  }

  private func sanitizedCommand(from message: [String: Any]) -> [String: Any]? {
    guard message["kind"] as? String == "workoutCommand" else {
      return nil
    }

    guard let type = message["type"] as? String else {
      return nil
    }

    var command: [String: Any] = [
      "type": type,
      "setId": message["setId"] as? String ?? NSNull()
    ]

    if let field = message["field"] as? String {
      command["field"] = field
    }

    if let direction = message["direction"] as? String {
      command["direction"] = direction
    }

    if let value = message["value"] as? Double {
      command["value"] = value
    } else if let value = message["value"] as? Int {
      command["value"] = value
    } else {
      command["value"] = NSNull()
    }

    return command
  }

  private func receiveCommand(_ message: [String: Any]) {
    guard let command = sanitizedCommand(from: message) else {
      return
    }

    if command["type"] as? String == "requestSnapshot",
      let latestContext,
      let session = activeSession(),
      session.activationState == .activated {
      send(context: latestContext, session: session)
    }

    DispatchQueue.main.async { [weak self] in
      self?.onCommand?(command)
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated, let latestContext else {
      return
    }
    send(context: latestContext, session: session)
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    receiveCommand(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    receiveCommand(userInfo)
  }
}

public class LiftHealthModule: Module {
  private let healthStore = HKHealthStore()
  private static let notificationDelegate = LiftHealthNotificationDelegate()
  private var restTimerScheduleGeneration = 0
  private var unfinishedWorkoutScheduleGeneration = 0

  public func definition() -> ModuleDefinition {
    Name("LiftHealth")

    Events(onUnfinishedWorkoutReminder, onWatchWorkoutCommand)

    OnCreate {
      Self.notificationDelegate.onUnfinishedWorkoutReminder = { [weak self] in
        self?.sendEvent(onUnfinishedWorkoutReminder, ["kind": "unfinishedWorkout"])
      }
      LiftWatchConnectivityBridge.shared.onCommand = { [weak self] command in
        self?.sendEvent(onWatchWorkoutCommand, command)
      }
    }

    Function("isHealthAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    AsyncFunction("getHealthAuthorizationStatus") { (promise: Promise) in
      self.getHealthAuthorizationStatus(promise: promise)
    }

    AsyncFunction("requestHealthAuthorization") { (promise: Promise) in
      self.requestHealthAuthorization(promise: promise)
    }

    AsyncFunction("getLatestBodyWeight") { (promise: Promise) in
      self.getLatestBodyWeight(promise: promise)
    }

    AsyncFunction("finishStrengthWorkout") { (startedAtMs: Double, endedAtMs: Double, promise: Promise) in
      self.finishStrengthWorkout(startedAtMs: startedAtMs, endedAtMs: endedAtMs, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("scheduleWorkoutTimerNotification") { (seconds: Double, promise: Promise) in
      self.scheduleWorkoutTimerNotification(seconds: seconds, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("startOrUpdateRestTimerLiveActivity") { (durationSeconds: Double, endsAtMs: Double, title: String?, promise: Promise) in
      self.startOrUpdateRestTimerLiveActivity(durationSeconds: durationSeconds, endsAtMs: endsAtMs, title: title, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("endRestTimerLiveActivity") { (promise: Promise) in
      self.endRestTimerLiveActivity(promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("cancelWorkoutTimerNotification") { (identifier: String?, promise: Promise) in
      self.cancelWorkoutTimerNotification(identifier: identifier, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("scheduleUnfinishedWorkoutNotification") { (workoutName: String, seconds: Double, promise: Promise) in
      self.scheduleUnfinishedWorkoutNotification(workoutName: workoutName, seconds: seconds, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("cancelUnfinishedWorkoutNotification") { (promise: Promise) in
      self.cancelUnfinishedWorkoutNotification(promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("updateWatchWorkoutSnapshot") { (snapshot: [String: Any], promise: Promise) in
      promise.resolve(LiftWatchConnectivityBridge.shared.update(snapshot: snapshot))
    }.runOnQueue(.main)

    AsyncFunction("clearWatchWorkoutSnapshot") { (promise: Promise) in
      promise.resolve(LiftWatchConnectivityBridge.shared.clear())
    }.runOnQueue(.main)
  }

  private var bodyMassType: HKQuantityType? {
    HKQuantityType.quantityType(forIdentifier: .bodyMass)
  }

  private func requestHealthAuthorization(promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.resolve([
        "available": false,
        "canWriteWorkouts": false
      ])
      return
    }

    let workoutType = HKObjectType.workoutType()
    let typesToShare: Set<HKSampleType> = [workoutType]
    var typesToRead = Set<HKObjectType>()

    if let bodyMassType {
      typesToRead.insert(bodyMassType)
    }

    healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { success, error in
      if let error {
        promise.reject("ERR_HEALTH_AUTH", error.localizedDescription)
        return
      }

      promise.resolve([
        "available": true,
        "authorized": success,
        "canWriteWorkouts": self.healthStore.authorizationStatus(for: workoutType) == .sharingAuthorized
      ])
    }
  }

  private func getHealthAuthorizationStatus(promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.resolve([
        "available": false,
        "authorized": false,
        "canWriteWorkouts": false
      ])
      return
    }

    let workoutStatus = healthStore.authorizationStatus(for: HKObjectType.workoutType())
    promise.resolve([
      "available": true,
      "authorized": workoutStatus == .sharingAuthorized,
      "canWriteWorkouts": workoutStatus == .sharingAuthorized
    ])
  }

  private func getLatestBodyWeight(promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.resolve(nil)
      return
    }
    guard let bodyMassType else {
      promise.resolve(nil)
      return
    }

    let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
    let query = HKSampleQuery(sampleType: bodyMassType, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
      if let error {
        promise.reject("ERR_BODY_WEIGHT", error.localizedDescription)
        return
      }

      guard let sample = samples?.first as? HKQuantitySample else {
        promise.resolve(nil)
        return
      }

      promise.resolve([
        "valueLb": sample.quantity.doubleValue(for: .pound()),
        "date": ISO8601DateFormatter().string(from: sample.endDate)
      ])
    }

    healthStore.execute(query)
  }

  private func finishStrengthWorkout(startedAtMs: Double, endedAtMs: Double, promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.resolve([
        "saved": false,
        "live": false,
        "message": "Health data is not available on this device."
      ])
      return
    }

    guard healthStore.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized else {
      promise.resolve([
        "saved": false,
        "live": false,
        "message": "Workout write permission is not enabled."
      ])
      return
    }

    let startDate = dateFromMilliseconds(startedAtMs) ?? Date(timeIntervalSince1970: startedAtMs / 1000)
    let endDate = maxDate(dateFromMilliseconds(endedAtMs) ?? Date(), after: startDate)

    saveCompletedWorkout(startDate: startDate, endDate: endDate, promise: promise)
  }

  private func saveCompletedWorkout(startDate: Date, endDate: Date, promise: Promise) {
    let configuration = strengthConfiguration()
    let builder = HKWorkoutBuilder(healthStore: healthStore, configuration: configuration, device: .local())

    builder.beginCollection(withStart: startDate) { success, error in
      if let error {
        promise.reject("ERR_WORKOUT_SAVE", error.localizedDescription)
        return
      }
      if !success {
        promise.reject("ERR_WORKOUT_SAVE", "HealthKit did not start fallback workout collection.")
        return
      }

      builder.endCollection(withEnd: endDate) { success, error in
        if let error {
          promise.reject("ERR_WORKOUT_SAVE", error.localizedDescription)
          return
        }
        if !success {
          promise.reject("ERR_WORKOUT_SAVE", "HealthKit did not end fallback workout collection.")
          return
        }

        builder.finishWorkout { workout, error in
          if let error {
            promise.reject("ERR_WORKOUT_SAVE", error.localizedDescription)
            return
          }

          promise.resolve([
            "saved": true,
            "live": false,
            "workoutId": workout?.uuid.uuidString ?? ""
          ])
        }
      }
    }
  }

  private func scheduleWorkoutTimerNotification(seconds: Double, promise: Promise) {
    let duration = max(1, seconds)
    let center = UNUserNotificationCenter.current()
    center.delegate = Self.notificationDelegate
    restTimerScheduleGeneration += 1
    let scheduleGeneration = restTimerScheduleGeneration

    center.requestAuthorization(options: [.alert, .sound]) { granted, error in
      DispatchQueue.main.async {
        guard scheduleGeneration == self.restTimerScheduleGeneration else {
          promise.resolve([
            "scheduled": false,
            "message": "Rest timer was replaced."
          ])
          return
        }

        if let error {
          promise.reject("ERR_TIMER_NOTIFICATION", error.localizedDescription)
          return
        }

        guard granted else {
          promise.resolve([
            "scheduled": false,
            "message": "Notifications are not enabled."
          ])
          return
        }

        let content = UNMutableNotificationContent()
        content.title = "Rest timer"
        content.body = "Your rest is over."
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: duration, repeats: false)
        let request = UNNotificationRequest(
          identifier: restTimerNotificationIdentifier,
          content: content,
          trigger: trigger
        )

        center.removePendingNotificationRequests(withIdentifiers: [restTimerNotificationIdentifier])
        center.removeDeliveredNotifications(withIdentifiers: [restTimerNotificationIdentifier])
        self.removeLegacyRestTimerNotifications(center: center)

        center.add(request) { error in
          if let error {
            promise.reject("ERR_TIMER_NOTIFICATION", error.localizedDescription)
            return
          }

          promise.resolve([
            "scheduled": true,
            "identifier": restTimerNotificationIdentifier,
            "seconds": duration
          ])
        }
      }
    }
  }

  private func startOrUpdateRestTimerLiveActivity(
    durationSeconds: Double,
    endsAtMs: Double,
    title: String?,
    promise: Promise
  ) {
    guard #available(iOS 16.2, *) else {
      promise.resolve([
        "active": false,
        "available": false,
        "message": "Live Activities require iOS 16.2 or newer."
      ])
      return
    }

    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      promise.resolve([
        "active": false,
        "available": false,
        "message": "Live Activities are disabled for this app."
      ])
      return
    }

    let now = Date()
    let endsAt = maxDate(dateFromMilliseconds(endsAtMs) ?? now.addingTimeInterval(durationSeconds), after: now)
    let startedAt = now
    let state = LiftRestTimerAttributes.ContentState(
      startedAt: startedAt,
      endsAt: endsAt,
      title: title?.isEmpty == false ? title! : "rest timer"
    )
    let content = ActivityContent(state: state, staleDate: endsAt)

    Task {
      do {
        if let activity = Activity<LiftRestTimerAttributes>.activities.first {
          await activity.update(content)
          promise.resolve([
            "active": true,
            "available": true,
            "activityId": activity.id,
            "message": NSNull()
          ])
          return
        }

        let activity = try Activity.request(
          attributes: LiftRestTimerAttributes(name: "Lift Prog Rest Timer"),
          content: content,
          pushType: nil
        )

        promise.resolve([
          "active": true,
          "available": true,
          "activityId": activity.id,
          "message": NSNull()
        ])
      } catch {
        promise.reject("ERR_REST_TIMER_ACTIVITY", error.localizedDescription)
      }
    }
  }

  private func endRestTimerLiveActivity(promise: Promise) {
    guard #available(iOS 16.2, *) else {
      promise.resolve([
        "ended": false,
        "available": false
      ])
      return
    }

    let now = Date()
    let state = LiftRestTimerAttributes.ContentState(
      startedAt: now,
      endsAt: now.addingTimeInterval(1),
      title: "rest timer"
    )
    let content = ActivityContent(state: state, staleDate: nil)

    Task {
      for activity in Activity<LiftRestTimerAttributes>.activities {
        await activity.end(content, dismissalPolicy: .immediate)
      }

      promise.resolve([
        "ended": true,
        "available": true
      ])
    }
  }

  private func cancelWorkoutTimerNotification(identifier _: String?, promise: Promise) {
    let center = UNUserNotificationCenter.current()
    restTimerScheduleGeneration += 1
    center.removePendingNotificationRequests(withIdentifiers: [restTimerNotificationIdentifier])
    center.removeDeliveredNotifications(withIdentifiers: [restTimerNotificationIdentifier])
    removeLegacyRestTimerNotifications(center: center)
    promise.resolve(["cancelled": true])
  }

  private func removeLegacyRestTimerNotifications(center: UNUserNotificationCenter) {
    center.getPendingNotificationRequests { requests in
      let pendingIdentifiers = requests
        .map(\.identifier)
        .filter {
          $0.hasPrefix(restTimerNotificationPrefix) &&
            $0 != restTimerNotificationIdentifier
        }

      center.getDeliveredNotifications { notifications in
        let deliveredIdentifiers = notifications
          .map(\.request.identifier)
          .filter {
            $0.hasPrefix(restTimerNotificationPrefix) &&
              $0 != restTimerNotificationIdentifier
          }

        center.removePendingNotificationRequests(withIdentifiers: pendingIdentifiers)
        center.removeDeliveredNotifications(withIdentifiers: deliveredIdentifiers)
      }
    }
  }

  private func scheduleUnfinishedWorkoutNotification(workoutName: String, seconds: Double, promise: Promise) {
    let duration = max(1, seconds)
    let center = UNUserNotificationCenter.current()
    center.delegate = Self.notificationDelegate
    unfinishedWorkoutScheduleGeneration += 1
    let scheduleGeneration = unfinishedWorkoutScheduleGeneration

    center.requestAuthorization(options: [.alert, .sound]) { granted, error in
      DispatchQueue.main.async {
        guard scheduleGeneration == self.unfinishedWorkoutScheduleGeneration else {
          promise.resolve([
            "scheduled": false,
            "message": "Unfinished workout reminder was replaced."
          ])
          return
        }

        if let error {
          promise.reject("ERR_UNFINISHED_WORKOUT_NOTIFICATION", error.localizedDescription)
          return
        }

        guard granted else {
          promise.resolve([
            "scheduled": false,
            "message": "Notifications are not enabled."
          ])
          return
        }

        center.removePendingNotificationRequests(withIdentifiers: [unfinishedWorkoutNotificationIdentifier])
        center.removeDeliveredNotifications(withIdentifiers: [unfinishedWorkoutNotificationIdentifier])
        self.removeLegacyUnfinishedWorkoutNotifications(center: center)

        let content = UNMutableNotificationContent()
        content.title = "Unfinished Workout"
        content.body = "Your current workout is still active. Do you need to finish it?"
        content.sound = .default
        content.userInfo = [
          "kind": "unfinishedWorkout",
          "workoutName": workoutName
        ]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: duration, repeats: false)
        let request = UNNotificationRequest(
          identifier: unfinishedWorkoutNotificationIdentifier,
          content: content,
          trigger: trigger
        )

        center.add(request) { error in
          if let error {
            promise.reject("ERR_UNFINISHED_WORKOUT_NOTIFICATION", error.localizedDescription)
            return
          }

          promise.resolve([
            "scheduled": true,
            "identifier": unfinishedWorkoutNotificationIdentifier,
            "seconds": duration
          ])
        }
      }
    }
  }

  private func cancelUnfinishedWorkoutNotification(promise: Promise) {
    let center = UNUserNotificationCenter.current()
    unfinishedWorkoutScheduleGeneration += 1
    center.removePendingNotificationRequests(withIdentifiers: [unfinishedWorkoutNotificationIdentifier])
    center.removeDeliveredNotifications(withIdentifiers: [unfinishedWorkoutNotificationIdentifier])
    removeLegacyUnfinishedWorkoutNotifications(center: center)
    promise.resolve(["cancelled": true])
  }

  private func removeLegacyUnfinishedWorkoutNotifications(center: UNUserNotificationCenter) {
    center.getPendingNotificationRequests { requests in
      let pendingIdentifiers = requests
        .map(\.identifier)
        .filter {
          $0.hasPrefix(unfinishedWorkoutNotificationPrefix) &&
            $0 != unfinishedWorkoutNotificationIdentifier
        }

      center.getDeliveredNotifications { notifications in
        let deliveredIdentifiers = notifications
          .map(\.request.identifier)
          .filter {
            $0.hasPrefix(unfinishedWorkoutNotificationPrefix) &&
              $0 != unfinishedWorkoutNotificationIdentifier
          }

        center.removePendingNotificationRequests(withIdentifiers: pendingIdentifiers)
        center.removeDeliveredNotifications(withIdentifiers: deliveredIdentifiers)
      }
    }
  }

  private func strengthConfiguration() -> HKWorkoutConfiguration {
    let configuration = HKWorkoutConfiguration()
    configuration.activityType = .traditionalStrengthTraining
    configuration.locationType = .indoor
    return configuration
  }

  private func dateFromMilliseconds(_ value: Double?) -> Date? {
    guard let value, value.isFinite else {
      return nil
    }
    return Date(timeIntervalSince1970: value / 1000)
  }

  private func maxDate(_ date: Date, after startDate: Date) -> Date {
    if date.timeIntervalSince(startDate) >= 1 {
      return date
    }
    return startDate.addingTimeInterval(1)
  }
}
