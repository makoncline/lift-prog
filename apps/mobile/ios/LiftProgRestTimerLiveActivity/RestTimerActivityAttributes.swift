import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct LiftRestTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var startedAt: Date
    var endsAt: Date
    var title: String
  }

  var name: String
}
