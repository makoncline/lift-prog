import Foundation
import WatchConnectivity

struct WatchWorkoutItemSnapshot: Equatable {
  var exerciseName: String
  var setId: String?
  var setLabel: String
  var setText: String
  var setWeight: Double?
  var setReps: Int?
  var setWeightModifier: String?
  var setCompleted: Bool
}

struct WatchWorkoutSnapshot: Equatable {
  var workoutName: String
  var exerciseName: String
  var setId: String?
  var setLabel: String
  var setText: String
  var setWeight: Double?
  var setReps: Int?
  var setWeightModifier: String?
  var setCompleted: Bool
  var restText: String
  var restTimerRunning: Bool
  var restTimerRemainingSeconds: Int?
  var restTimerDurationSeconds: Int?
  var restTimerEndsAt: String?
  var previousSet: WatchWorkoutItemSnapshot?
  var nextSet: WatchWorkoutItemSnapshot?
  var previousExercise: WatchWorkoutItemSnapshot?
  var nextExercise: WatchWorkoutItemSnapshot?
  var isActive: Bool
  var updatedAt: String

  static let inactive = WatchWorkoutSnapshot(context: [:])

  init(context: [String: Any]) {
    workoutName = context["workoutName"] as? String ?? ""
    exerciseName = context["exerciseName"] as? String ?? ""
    setId = Self.stringValue(context["setId"])
    setLabel = context["setLabel"] as? String ?? ""
    setText = context["setText"] as? String ?? ""
    setWeight = Self.doubleValue(context["setWeight"])
    setReps = Self.intValue(context["setReps"])
    setWeightModifier = Self.stringValue(context["setWeightModifier"])
    setCompleted = Self.boolValue(context["setCompleted"])
    restText = context["restText"] as? String ?? ""
    restTimerRunning = Self.boolValue(context["restTimerRunning"])
    restTimerRemainingSeconds = Self.intValue(context["restTimerRemainingSeconds"])
    restTimerDurationSeconds = Self.intValue(context["restTimerDurationSeconds"])
    restTimerEndsAt = Self.stringValue(context["restTimerEndsAt"])
    previousSet = Self.itemValue(context["previousSet"])
    nextSet = Self.itemValue(context["nextSet"])
    previousExercise = Self.itemValue(context["previousExercise"])
    nextExercise = Self.itemValue(context["nextExercise"])
    isActive = Self.boolValue(context["isActive"])
    updatedAt = context["updatedAt"] as? String ?? ""
  }

  func restTimerRemainingSeconds(at date: Date = Date()) -> Int? {
    guard restTimerRunning else { return nil }

    if let restTimerEndsAtDate {
      return max(0, Int(ceil(restTimerEndsAtDate.timeIntervalSince(date))))
    }

    return restTimerRemainingSeconds
  }

  private var restTimerEndsAtDate: Date? {
    guard let restTimerEndsAt else { return nil }
    return Self.iso8601FormatterWithFractionalSeconds.date(from: restTimerEndsAt)
      ?? Self.iso8601Formatter.date(from: restTimerEndsAt)
  }

  private static func stringValue(_ value: Any?) -> String? {
    guard let value, !(value is NSNull) else { return nil }
    if let value = value as? String, !value.isEmpty {
      return value
    }
    return nil
  }

  private static func itemValue(_ value: Any?) -> WatchWorkoutItemSnapshot? {
    guard let context = value as? [String: Any] else { return nil }
    return WatchWorkoutItemSnapshot(
      exerciseName: context["exerciseName"] as? String ?? "",
      setId: stringValue(context["setId"]),
      setLabel: context["setLabel"] as? String ?? "",
      setText: context["setText"] as? String ?? "",
      setWeight: doubleValue(context["setWeight"]),
      setReps: intValue(context["setReps"]),
      setWeightModifier: stringValue(context["setWeightModifier"]),
      setCompleted: boolValue(context["setCompleted"])
    )
  }

  private static let iso8601FormatterWithFractionalSeconds: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  private static let iso8601Formatter = ISO8601DateFormatter()

  private static func doubleValue(_ value: Any?) -> Double? {
    guard let value, !(value is NSNull) else { return nil }
    if let value = value as? Double {
      return value
    }
    if let value = value as? Int {
      return Double(value)
    }
    if let value = value as? NSNumber {
      return value.doubleValue
    }
    if let value = value as? String {
      return Double(value)
    }
    return nil
  }

  private static func intValue(_ value: Any?) -> Int? {
    guard let double = doubleValue(value) else { return nil }
    return Int(double.rounded())
  }

  private static func boolValue(_ value: Any?) -> Bool {
    guard let value, !(value is NSNull) else { return false }
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
}

final class WatchWorkoutStore: NSObject, ObservableObject, WCSessionDelegate {
  @Published var snapshot: WatchWorkoutSnapshot = .inactive
#if DEBUG
  private(set) var atlasState: Int?
#endif

  override init() {
    super.init()
#if DEBUG
    if let state = Self.launchAtlasState {
      atlasState = state
      snapshot = WatchWorkoutSnapshot(context: Self.atlasFixture(for: state))
      return
    }
#endif
    activateSession()
  }

#if DEBUG
  func loadActiveWorkoutFixture() {
    snapshot = WatchWorkoutSnapshot(context: Self.activeWorkoutFixture)
  }

  private static var activeWorkoutFixture: [String: Any] {
    let timerEnd = ISO8601DateFormatter().string(
      from: Date().addingTimeInterval(95)
    )
    return [
      "workoutName": "Pull day",
      "exerciseName": "Pull-ups",
      "setId": "fixture-set-2",
      "setLabel": "set 2",
      "setText": "BW+25lb x 8",
      "setWeight": 25.0,
      "setReps": 8,
      "setWeightModifier": "bodyweight",
      "setCompleted": false,
      "restText": "rest 3:00",
      "restTimerRunning": true,
      "restTimerRemainingSeconds": 95,
      "restTimerDurationSeconds": 180,
      "restTimerEndsAt": timerEnd,
      "previousSet": [
        "exerciseName": "Pull-ups",
        "setId": "fixture-set-1",
        "setLabel": "set 1",
        "setText": "BW+25lb x 11",
        "setWeight": 25.0,
        "setReps": 11,
        "setWeightModifier": "bodyweight",
        "setCompleted": true
      ],
      "nextSet": [
        "exerciseName": "Pull-ups",
        "setId": "fixture-set-3",
        "setLabel": "set 3",
        "setText": "BW+20lb x 8",
        "setWeight": 20.0,
        "setReps": 8,
        "setWeightModifier": "bodyweight",
        "setCompleted": false
      ],
      "previousExercise": [
        "exerciseName": "Lat pulldown",
        "setId": "fixture-lat-set-1",
        "setLabel": "set 1",
        "setText": "125lb x 10",
        "setWeight": 125.0,
        "setReps": 10,
        "setCompleted": true
      ],
      "nextExercise": [
        "exerciseName": "Rows",
        "setId": "fixture-row-set-1",
        "setLabel": "set 1",
        "setText": "75lb x 11",
        "setWeight": 75.0,
        "setReps": 11,
        "setCompleted": false
      ],
      "isActive": true,
      "updatedAt": ISO8601DateFormatter().string(from: Date())
    ]
  }

  private static var launchAtlasState: Int? {
    let arguments = ProcessInfo.processInfo.arguments
    guard let flagIndex = arguments.firstIndex(of: "-uiAtlasState"),
      arguments.indices.contains(flagIndex + 1)
    else {
      return nil
    }
    return Int(arguments[flagIndex + 1])
  }

  private static func atlasFixture(for state: Int) -> [String: Any] {
    guard ![70, 75].contains(state) else {
      return [
        "isActive": false,
        "updatedAt": ISO8601DateFormatter().string(from: Date())
      ]
    }

    var fixture = activeWorkoutFixture
    fixture["restTimerRunning"] = state == 74
    fixture["restTimerRemainingSeconds"] = state == 74 ? 95 : nil
    fixture["restTimerEndsAt"] =
      state == 74
      ? ISO8601DateFormatter().string(from: Date().addingTimeInterval(95))
      : nil

    switch state {
    case 124:
      fixture["setId"] = "fixture-warm-up-1"
      fixture["setLabel"] = "warm-up 1"
      fixture["setText"] = "BW x 20"
      fixture["setWeight"] = 0.0
      fixture["setReps"] = 20
    case 126:
      fixture["setId"] = "fixture-set-3"
      fixture["setLabel"] = "set 3"
      fixture["setText"] = "BW+20lb x 8"
      fixture["setWeight"] = 20.0
      fixture["setReps"] = 8
    case 127:
      fixture["exerciseName"] = "Rows"
      fixture["setId"] = "fixture-row-set-1"
      fixture["setLabel"] = "set 1"
      fixture["setText"] = "75lb x 11"
      fixture["setWeight"] = 75.0
      fixture["setReps"] = 11
      fixture["setWeightModifier"] = nil
    case 128:
      fixture["setCompleted"] = true
    default:
      break
    }

    return fixture
  }
#endif

  private func activateSession() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
    if !session.receivedApplicationContext.isEmpty {
      snapshot = WatchWorkoutSnapshot(context: session.receivedApplicationContext)
    }
    requestSnapshot()
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated else { return }
    if !session.receivedApplicationContext.isEmpty {
      apply(session.receivedApplicationContext)
    }
    requestSnapshot()
  }

  #if !os(watchOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
      session.activate()
    }
  #endif

  func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    apply(applicationContext)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    apply(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    apply(userInfo)
  }

  private func apply(_ context: [String: Any]) {
    guard context["kind"] as? String != "workoutCommand" else {
      return
    }

    let nextSnapshot = WatchWorkoutSnapshot(context: context)
    DispatchQueue.main.async { [weak self] in
      self?.snapshot = nextSnapshot
    }
  }

  func requestSnapshot() {
    sendCommand(
      [
        "kind": "workoutCommand",
        "type": "requestSnapshot"
      ],
      queueIfUnreachable: true
    )
  }

  func updateSetValue(field: String, value: Double) {
    guard let setId = snapshot.setId else { return }
    sendCommand(
      [
        "kind": "workoutCommand",
        "type": "setSetValue",
        "setId": setId,
        "field": field,
        "value": value
      ],
      queueIfUnreachable: true
    )
  }

  func toggleSetCompleted() {
    guard let setId = snapshot.setId else { return }
    sendCommand(
      [
        "kind": "workoutCommand",
        "type": "toggleSetCompleted",
        "setId": setId
      ],
      queueIfUnreachable: true
    )
  }

  func navigateSet(direction: String) {
    var command: [String: Any] = [
      "kind": "workoutCommand",
      "type": "navigateSet",
      "direction": direction
    ]
    if let setId = snapshot.setId {
      command["setId"] = setId
    }
    sendCommand(command, queueIfUnreachable: true)
  }

  func navigateExercise(direction: String) {
    sendCommand(
      [
        "kind": "workoutCommand",
        "type": "navigateExercise",
        "direction": direction
      ],
      queueIfUnreachable: true
    )
  }

  func startRestTimer() {
    sendCommand(
      [
        "kind": "workoutCommand",
        "type": "startRestTimer"
      ],
      queueIfUnreachable: true
    )
  }

  func resetRestTimer() {
    sendCommand(
      [
        "kind": "workoutCommand",
        "type": "resetRestTimer"
      ],
      queueIfUnreachable: true
    )
  }

  func stopRestTimer() {
    sendCommand(
      [
        "kind": "workoutCommand",
        "type": "stopRestTimer"
      ],
      queueIfUnreachable: true
    )
  }

  private func sendCommand(
    _ message: [String: Any],
    queueIfUnreachable: Bool
  ) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.activationState == .notActivated {
      session.activate()
    }

    if session.isReachable {
      session.sendMessage(message, replyHandler: nil) { error in
        if queueIfUnreachable {
          session.transferUserInfo(message)
        }
      }
      return
    }

    if queueIfUnreachable {
      session.transferUserInfo(message)
    }
  }
}
