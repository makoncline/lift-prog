import ExpoModulesCore
import HealthKit
import UserNotifications

private final class LiftHealthNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
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
}

public class LiftHealthModule: Module {
  private let healthStore = HKHealthStore()
  private static let notificationDelegate = LiftHealthNotificationDelegate()
  private var activeSession: AnyObject?
  private var activeBuilder: AnyObject?
  private var activeStartDate: Date?

  public func definition() -> ModuleDefinition {
    Name("LiftHealth")

    Function("isHealthAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    AsyncFunction("requestHealthAuthorization") { (promise: Promise) in
      self.requestHealthAuthorization(promise: promise)
    }

    AsyncFunction("getLatestBodyWeight") { (promise: Promise) in
      self.getLatestBodyWeight(promise: promise)
    }

    AsyncFunction("startStrengthWorkout") { (startedAtMs: Double?, promise: Promise) in
      self.startStrengthWorkout(startedAtMs: startedAtMs, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("finishStrengthWorkout") { (startedAtMs: Double, endedAtMs: Double, promise: Promise) in
      self.finishStrengthWorkout(startedAtMs: startedAtMs, endedAtMs: endedAtMs, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("cancelStrengthWorkout") { (promise: Promise) in
      self.cancelStrengthWorkout(promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("scheduleWorkoutTimerNotification") { (seconds: Double, promise: Promise) in
      self.scheduleWorkoutTimerNotification(seconds: seconds, promise: promise)
    }
  }

  private var bodyMassType: HKQuantityType? {
    HKQuantityType.quantityType(forIdentifier: .bodyMass)
  }

  private var heartRateType: HKQuantityType? {
    HKQuantityType.quantityType(forIdentifier: .heartRate)
  }

  private var activeEnergyType: HKQuantityType? {
    HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)
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
    if let heartRateType {
      typesToRead.insert(heartRateType)
    }
    if let activeEnergyType {
      typesToRead.insert(activeEnergyType)
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

  private func startStrengthWorkout(startedAtMs: Double?, promise: Promise) {
    guard HKHealthStore.isHealthDataAvailable() else {
      promise.resolve([
        "started": false,
        "live": false,
        "message": "Health data is not available on this device."
      ])
      return
    }

    guard healthStore.authorizationStatus(for: HKObjectType.workoutType()) == .sharingAuthorized else {
      promise.resolve([
        "started": false,
        "live": false,
        "message": "Workout write permission is not enabled."
      ])
      return
    }

    guard #available(iOS 26.0, *) else {
      promise.resolve([
        "started": true,
        "live": false,
        "message": "Live HealthKit workout sessions require iOS 26. The workout will be saved to Health when finished."
      ])
      return
    }

    if activeSession != nil || activeBuilder != nil {
      promise.resolve([
        "started": true,
        "live": true,
        "message": "A Health workout is already running."
      ])
      return
    }

    let startDate = dateFromMilliseconds(startedAtMs) ?? Date()
    let configuration = strengthConfiguration()

    do {
      let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
      let builder = session.associatedWorkoutBuilder()

      builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)

      activeSession = session
      activeBuilder = builder
      activeStartDate = startDate

      builder.beginCollection(withStart: startDate) { success, error in
        if let error {
          self.activeSession = nil
          self.activeBuilder = nil
          self.activeStartDate = nil
          promise.reject("ERR_WORKOUT_START", error.localizedDescription)
          return
        }

        if !success {
          self.activeSession = nil
          self.activeBuilder = nil
          self.activeStartDate = nil
          promise.reject("ERR_WORKOUT_START", "HealthKit did not start workout collection.")
          return
        }

        session.startActivity(with: startDate)
        promise.resolve([
          "started": true,
          "live": true,
          "message": NSNull()
        ])
      }
    } catch {
      promise.reject("ERR_WORKOUT_START", error.localizedDescription)
    }
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

    if #available(iOS 26.0, *),
      let session = activeSession as? HKWorkoutSession,
      let builder = activeBuilder as? HKLiveWorkoutBuilder {
      session.stopActivity(with: endDate)
      builder.endCollection(withEnd: endDate) { success, error in
        if let error {
          self.clearActiveWorkout()
          promise.reject("ERR_WORKOUT_FINISH", error.localizedDescription)
          return
        }
        if !success {
          self.clearActiveWorkout()
          promise.reject("ERR_WORKOUT_FINISH", "HealthKit did not stop workout collection.")
          return
        }

        builder.finishWorkout { workout, error in
          session.end()
          self.clearActiveWorkout()

          if let error {
            promise.reject("ERR_WORKOUT_FINISH", error.localizedDescription)
            return
          }

          promise.resolve([
            "saved": true,
            "live": true,
            "workoutId": workout?.uuid.uuidString ?? ""
          ])
        }
      }
      return
    }

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

  private func cancelStrengthWorkout(promise: Promise) {
    if #available(iOS 26.0, *), let session = activeSession as? HKWorkoutSession {
      session.end()
    }
    if #available(iOS 26.0, *), let builder = activeBuilder as? HKLiveWorkoutBuilder {
      builder.discardWorkout()
    }
    clearActiveWorkout()
    promise.resolve(["cancelled": true])
  }

  private func scheduleWorkoutTimerNotification(seconds: Double, promise: Promise) {
    let duration = max(1, seconds)
    let center = UNUserNotificationCenter.current()
    center.delegate = Self.notificationDelegate

    center.requestAuthorization(options: [.alert, .sound]) { granted, error in
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
      content.body = "Three minutes is up."
      content.sound = .default

      let identifier = "lift-prog-rest-\(UUID().uuidString)"
      let trigger = UNTimeIntervalNotificationTrigger(timeInterval: duration, repeats: false)
      let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

      center.add(request) { error in
        if let error {
          promise.reject("ERR_TIMER_NOTIFICATION", error.localizedDescription)
          return
        }

        promise.resolve([
          "scheduled": true,
          "identifier": identifier,
          "seconds": duration
        ])
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

  private func clearActiveWorkout() {
    activeSession = nil
    activeBuilder = nil
    activeStartDate = nil
  }
}
