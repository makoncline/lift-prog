import ActivityKit
import SwiftUI
import WidgetKit

@available(iOSApplicationExtension 16.2, *)
struct RestTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiftRestTimerAttributes.self) { context in
      LockScreenRestTimerView(context: context)
        .activityBackgroundTint(Color(.systemBackground))
        .activitySystemActionForegroundColor(Color(.label))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label("rest", systemImage: "timer")
            .font(.system(.caption, design: .monospaced))
        }

        DynamicIslandExpandedRegion(.trailing) {
          RestCountdownText(context: context)
            .font(.system(.title3, design: .monospaced).weight(.bold))
        }

        DynamicIslandExpandedRegion(.bottom) {
          Text(context.state.title)
            .font(.system(.caption, design: .monospaced))
            .lineLimit(1)
        }
      } compactLeading: {
        Image(systemName: "timer")
      } compactTrailing: {
        RestCountdownText(context: context)
          .font(.system(.caption2, design: .monospaced).weight(.semibold))
      } minimal: {
        Image(systemName: "timer")
      }
      .keylineTint(Color(.label))
    }
  }
}

@available(iOSApplicationExtension 16.2, *)
private struct LockScreenRestTimerView: View {
  let context: ActivityViewContext<LiftRestTimerAttributes>

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      Image(systemName: "timer")
        .font(.system(size: 18, weight: .semibold))

      VStack(alignment: .leading, spacing: 2) {
        Text(context.state.title)
          .font(.system(.caption, design: .monospaced))
          .foregroundStyle(.secondary)
          .lineLimit(1)
        RestCountdownText(context: context)
          .font(.system(.title2, design: .monospaced).weight(.bold))
      }

      Spacer(minLength: 0)
    }
    .padding(.vertical, 8)
    .padding(.horizontal, 12)
  }
}

@available(iOSApplicationExtension 16.2, *)
private struct RestCountdownText: View {
  let context: ActivityViewContext<LiftRestTimerAttributes>

  var body: some View {
    Text(timerInterval: context.state.startedAt...context.state.endsAt, countsDown: true)
      .monospacedDigit()
      .lineLimit(1)
      .minimumScaleFactor(0.72)
  }
}
