import SwiftUI

@main
struct LiftProgWatchApp: App {
  @StateObject private var store = WatchWorkoutStore()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(store)
    }
  }
}
