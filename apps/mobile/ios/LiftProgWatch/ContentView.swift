import SwiftUI
import WatchKit

private enum WatchSetField {
  case weight
  case reps
}

private enum WatchDragAxis {
  case horizontal
  case vertical
}

private enum WatchSwipeDirection {
  case previousSet
  case nextSet
  case previousExercise
  case nextExercise
}

struct ContentView: View {
  @EnvironmentObject private var store: WatchWorkoutStore
  @State private var focusedField: WatchSetField = .reps
  @State private var weightValue: Double = 0
  @State private var repsValue: Double = 0
  @State private var syncedSetId: String?
  @State private var syncedWeight: Double?
  @State private var syncedReps: Int?
  @State private var dragOffset: CGSize = .zero
  @State private var dragAxis: WatchDragAxis?
  @State private var pendingSwipeDirection: WatchSwipeDirection?
  @State private var lastRestTimerCueIdentifier: String?

  private var crownValue: Binding<Double> {
    Binding(
      get: {
        focusedField == .weight ? weightValue : repsValue
      },
      set: { value in
        if focusedField == .weight {
          weightValue = roundedWeight(value)
        } else {
          repsValue = roundedReps(value)
        }
      }
    )
  }

  private var crownMinimum: Double {
    focusedField == .weight ? -500 : 0
  }

  private var crownMaximum: Double {
    focusedField == .weight ? 1_000 : 300
  }

  private var crownStep: Double {
    focusedField == .weight ? 2.5 : 1
  }

  var body: some View {
    GeometryReader { proxy in
      if store.snapshot.isActive {
        activeWorkoutView(availableSize: proxy.size)
          .padding(.horizontal, 4)
          .padding(.vertical, 4)
          .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
      } else {
        ScrollView {
          emptyStateView
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 4)
      }
    }
    .background(Color(.black))
    .dynamicTypeSize(.xSmall ... .large)
    .focusable(store.snapshot.isActive)
    .digitalCrownRotation(
      crownValue,
      from: crownMinimum,
      through: crownMaximum,
      by: crownStep,
      sensitivity: .medium,
      isContinuous: false,
      isHapticFeedbackEnabled: true
    )
    .onAppear {
      store.requestSnapshot()
      syncEditorValues(from: store.snapshot)
    }
    .onReceive(store.$snapshot) { snapshot in
      syncEditorValues(from: snapshot)
    }
    .onChange(of: store.snapshot.exerciseName) { _, _ in
      resetCompletedSnap()
    }
    .onChange(of: store.snapshot.setId) { _, _ in
      resetCompletedSnap()
    }
    .onChange(of: weightValue) { _, value in
      guard focusedField == .weight else { return }
      guard store.snapshot.isActive, store.snapshot.setId != nil else { return }
      if valuesDiffer(value, store.snapshot.setWeight ?? 0) {
        store.updateSetValue(field: "weight", value: roundedWeight(value))
      }
    }
    .onChange(of: repsValue) { _, value in
      guard focusedField == .reps else { return }
      guard store.snapshot.isActive, store.snapshot.setId != nil else { return }
      if valuesDiffer(value, Double(store.snapshot.setReps ?? 0)) {
        store.updateSetValue(field: "reps", value: roundedReps(value))
      }
    }
  }

  private func activeWorkoutView(availableSize: CGSize) -> some View {
    let compact = availableSize.height < 205

    return ZStack {
      if let direction = visibleSwipeDirection,
        let preview = previewItem(for: direction) {
        previewWorkoutSurface(preview, compact: compact)
          .offset(previewOffset(for: direction, availableSize: availableSize))
      }

      currentWorkoutSurface(compact: compact)
        .offset(dragOffset)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .contentShape(Rectangle())
    .gesture(snapGesture(availableSize: availableSize))
  }

  private func currentWorkoutSurface(compact: Bool) -> some View {
    VStack(alignment: .leading, spacing: compact ? 4 : 5) {
      Text(store.snapshot.workoutName)
        .font(.system(.caption2, design: .monospaced))
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.75)

      Text(store.snapshot.exerciseName)
        .font(.system(compact ? .subheadline : .headline, design: .monospaced).weight(.bold))
        .foregroundStyle(.primary)
        .lineLimit(compact ? 1 : 2)
        .minimumScaleFactor(0.72)

      Text(setContextText)
        .font(.system(.caption2, design: .monospaced).weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.68)

      HStack(spacing: 6) {
        valueButton(
          field: .weight,
          title: "weight",
          value: formattedWeight,
          compact: compact
        )
        Text("x")
          .font(.system(.caption, design: .monospaced))
          .foregroundStyle(.secondary)
        valueButton(
          field: .reps,
          title: "reps",
          value: formattedReps,
          compact: compact
        )
      }

      Button {
        store.toggleSetCompleted()
      } label: {
        HStack(spacing: 5) {
          Image(systemName: store.snapshot.setCompleted ? "checkmark.circle.fill" : "checkmark.circle")
          Text(store.snapshot.setCompleted ? "done" : "complete")
        }
        .font(.system(.caption2, design: .monospaced).weight(.semibold))
        .frame(maxWidth: .infinity)
        .padding(.vertical, compact ? 5 : 6)
        .background(
          RoundedRectangle(cornerRadius: 8)
            .fill(store.snapshot.setCompleted ? Color.green.opacity(0.22) : Color.white.opacity(0.08))
        )
        .overlay(
          RoundedRectangle(cornerRadius: 8)
            .stroke(store.snapshot.setCompleted ? Color.green.opacity(0.65) : Color.white.opacity(0.16), lineWidth: 1)
        )
      }
      .buttonStyle(.plain)

      restTimerView(compact: compact)

      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func previewWorkoutSurface(
    _ item: WatchWorkoutItemSnapshot,
    compact: Bool
  ) -> some View {
    VStack(alignment: .leading, spacing: compact ? 4 : 5) {
      Text(store.snapshot.workoutName)
        .font(.system(.caption2, design: .monospaced))
        .foregroundStyle(.secondary)
        .lineLimit(1)

      Text(item.exerciseName)
        .font(.system(compact ? .subheadline : .headline, design: .monospaced).weight(.bold))
        .lineLimit(compact ? 1 : 2)
        .minimumScaleFactor(0.72)

      Text(setContextText(for: item))
        .font(.system(.caption2, design: .monospaced).weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)

      HStack(spacing: 6) {
        previewValue(title: "weight", value: formattedWeight(for: item), compact: compact)
        Text("x")
          .font(.system(.caption, design: .monospaced))
          .foregroundStyle(.secondary)
        previewValue(title: "reps", value: formattedReps(for: item), compact: compact)
      }

      HStack(spacing: 5) {
        Image(systemName: item.setCompleted ? "checkmark.circle.fill" : "checkmark.circle")
        Text(item.setCompleted ? "done" : "complete")
      }
      .font(.system(.caption2, design: .monospaced).weight(.semibold))
      .frame(maxWidth: .infinity)
      .padding(.vertical, compact ? 5 : 6)
      .background(
        RoundedRectangle(cornerRadius: 8)
          .fill(Color.white.opacity(0.08))
      )

      HStack(spacing: 5) {
        Image(systemName: "timer")
          .imageScale(.small)
        Text(restTimerDisplayText(at: Date()))
          .font(.system(.caption2, design: .monospaced).weight(.bold))
      }
      .padding(.vertical, compact ? 5 : 6)
      .padding(.horizontal, 7)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Capsule().fill(Color.white.opacity(0.08)))

      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func previewValue(
    title: String,
    value: String,
    compact: Bool
  ) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(title)
        .font(.system(.caption2, design: .monospaced))
        .foregroundStyle(.secondary)
      Text(value)
        .font(.system(compact ? .body : .headline, design: .monospaced).weight(.bold))
        .lineLimit(1)
        .minimumScaleFactor(0.65)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.vertical, compact ? 4 : 5)
    .padding(.horizontal, 6)
    .background(
      RoundedRectangle(cornerRadius: 8)
        .fill(Color.white.opacity(0.06))
    )
  }

  private func restTimerView(compact: Bool) -> some View {
    TimelineView(.periodic(from: .now, by: 1)) { timeline in
      let remaining = store.snapshot.restTimerRemainingSeconds(at: timeline.date)

      Button {
        if store.snapshot.restTimerRunning {
          store.stopRestTimer()
        } else {
          store.startRestTimer()
        }
      } label: {
        ZStack(alignment: .leading) {
          if store.snapshot.restTimerRunning,
            let progress = restTimerProgress(at: timeline.date) {
            GeometryReader { proxy in
              Capsule()
                .fill(Color.white.opacity(0.10))
              Capsule()
                .fill(Color.white.opacity(0.32))
                .frame(width: proxy.size.width * progress)
            }
          }

          HStack(spacing: 5) {
            Image(systemName: "timer")
              .imageScale(.small)
            Text(restTimerDisplayText(at: timeline.date))
              .font(.system(.caption2, design: .monospaced).weight(.bold))
              .lineLimit(1)
              .minimumScaleFactor(0.75)
          }
          .foregroundStyle(.primary)
          .padding(.vertical, compact ? 5 : 6)
          .padding(.horizontal, 7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
          Capsule()
            .fill(store.snapshot.restTimerRunning ? Color.white.opacity(0.06) : Color.white.opacity(0.08))
        )
      }
      .buttonStyle(.plain)
      .onAppear {
        playRestTimerFinishedCueIfNeeded(remaining: remaining)
      }
      .onChange(of: remaining) { _, nextRemaining in
        playRestTimerFinishedCueIfNeeded(remaining: nextRemaining)
      }
      .onChange(of: store.snapshot.restTimerRunning) { _, isRunning in
        if !isRunning {
          lastRestTimerCueIdentifier = nil
        }
      }
    }
  }

  private func valueButton(
    field: WatchSetField,
    title: String,
    value: String,
    compact: Bool
  ) -> some View {
    Button {
      focusedField = field
    } label: {
      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .font(.system(.caption2, design: .monospaced))
          .foregroundStyle(.secondary)
        Text(value)
          .font(.system(compact ? .body : .headline, design: .monospaced).weight(.bold))
          .lineLimit(1)
          .minimumScaleFactor(0.65)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.vertical, compact ? 4 : 5)
      .padding(.horizontal, 6)
      .background(
        RoundedRectangle(cornerRadius: 8)
          .fill(field == focusedField ? Color.white.opacity(0.18) : Color.white.opacity(0.06))
      )
      .overlay(
        RoundedRectangle(cornerRadius: 8)
          .stroke(field == focusedField ? Color.white.opacity(0.75) : Color.white.opacity(0.14), lineWidth: 1)
      )
    }
    .buttonStyle(.plain)
  }

  private var setContextText: String {
    let setLabel = store.snapshot.setLabel.trimmingCharacters(in: .whitespacesAndNewlines)
    let setText = store.snapshot.setText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !setLabel.isEmpty else { return setText }
    guard !setText.isEmpty else { return setLabel }
    return "\(setLabel) · \(setText)"
  }

  private func setContextText(for item: WatchWorkoutItemSnapshot) -> String {
    let setLabel = item.setLabel.trimmingCharacters(in: .whitespacesAndNewlines)
    let setText = item.setText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !setLabel.isEmpty else { return setText }
    guard !setText.isEmpty else { return setLabel }
    return "\(setLabel) · \(setText)"
  }

  private var formattedWeight: String {
    if store.snapshot.setWeight == nil {
      return "-lb"
    }

    let weight = roundedWeight(weightValue)
    if store.snapshot.setWeightModifier == "bodyweight" {
      if abs(weight) < 0.001 {
        return "BW"
      }
      return weight > 0
        ? "BW+\(formatNumber(weight))lb"
        : "BW\(formatNumber(weight))lb"
    }

    return "\(formatNumber(weight))lb"
  }

  private var formattedReps: String {
    guard store.snapshot.setReps != nil else {
      return "-"
    }
    return formatNumber(roundedReps(repsValue))
  }

  private func formattedWeight(for item: WatchWorkoutItemSnapshot) -> String {
    guard let rawWeight = item.setWeight else {
      return item.setWeightModifier == "bodyweight" ? "BW" : "-lb"
    }

    let weight = roundedWeight(rawWeight)
    if item.setWeightModifier == "bodyweight" {
      if abs(weight) < 0.001 { return "BW" }
      return weight > 0
        ? "BW+\(formatNumber(weight))lb"
        : "BW\(formatNumber(weight))lb"
    }

    return "\(formatNumber(weight))lb"
  }

  private func formattedReps(for item: WatchWorkoutItemSnapshot) -> String {
    guard let reps = item.setReps else { return "-" }
    return String(reps)
  }

  private func restTimerDisplayText(at date: Date) -> String {
    if let remaining = store.snapshot.restTimerRemainingSeconds(at: date) {
      return formatTime(remaining)
    }
    if let duration = store.snapshot.restTimerDurationSeconds, duration > 0 {
      return formatTime(duration)
    }
    return store.snapshot.restText.replacingOccurrences(of: "rest ", with: "")
  }

  private func restTimerProgress(at date: Date) -> Double? {
    guard let remaining = store.snapshot.restTimerRemainingSeconds(at: date),
      let duration = store.snapshot.restTimerDurationSeconds,
      duration > 0
    else {
      return nil
    }
    return max(0, min(1, Double(remaining) / Double(duration)))
  }

  private func playRestTimerFinishedCueIfNeeded(remaining: Int?) {
    guard store.snapshot.restTimerRunning,
      let remaining,
      remaining <= 0,
      let identifier = restTimerCueIdentifier
    else {
      return
    }

    guard lastRestTimerCueIdentifier != identifier else { return }
    lastRestTimerCueIdentifier = identifier
    WKInterfaceDevice.current().play(.notification)
  }

  private var restTimerCueIdentifier: String? {
    if let endsAt = store.snapshot.restTimerEndsAt, !endsAt.isEmpty {
      return endsAt
    }
    if !store.snapshot.updatedAt.isEmpty {
      return store.snapshot.updatedAt
    }
    return store.snapshot.restTimerDurationSeconds.map { "duration-\($0)" }
  }

  private var emptyStateView: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Lift Prog")
        .font(.system(.headline, design: .monospaced).weight(.bold))
      Text("No active workout")
        .font(.system(.caption, design: .monospaced))
        .foregroundStyle(.secondary)
#if DEBUG
      Button("preview active workout") {
        store.loadActiveWorkoutFixture()
      }
      .font(.system(.caption2, design: .monospaced))
      .buttonStyle(.bordered)
#endif
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.top, 12)
  }

  private func syncEditorValues(from snapshot: WatchWorkoutSnapshot) {
    let nextWeight = snapshot.setWeight.map(roundedWeight)
    let nextReps = snapshot.setReps
    let setChanged = syncedSetId != snapshot.setId
    let weightChanged = optionalValuesDiffer(syncedWeight, nextWeight)
    let repsChanged = syncedReps != nextReps
    guard setChanged || weightChanged || repsChanged else { return }

    syncedSetId = snapshot.setId
    syncedWeight = nextWeight
    syncedReps = nextReps
    weightValue = nextWeight ?? 0
    repsValue = roundedReps(Double(nextReps ?? 0))
  }

  private func roundedWeight(_ value: Double) -> Double {
    (value / 2.5).rounded() * 2.5
  }

  private func roundedReps(_ value: Double) -> Double {
    max(0, value.rounded())
  }

  private func valuesDiffer(_ lhs: Double, _ rhs: Double) -> Bool {
    abs(lhs - rhs) > 0.001
  }

  private func optionalValuesDiffer(_ lhs: Double?, _ rhs: Double?) -> Bool {
    switch (lhs, rhs) {
    case (.none, .none):
      return false
    case let (.some(lhs), .some(rhs)):
      return valuesDiffer(lhs, rhs)
    default:
      return true
    }
  }

  private func formatNumber(_ value: Double) -> String {
    if abs(value.rounded() - value) < 0.001 {
      return String(Int(value.rounded()))
    }

    return String(format: "%.1f", value)
  }

  private func formatTime(_ seconds: Int) -> String {
    let clamped = max(0, seconds)
    return "\(clamped / 60):\(String(format: "%02d", clamped % 60))"
  }

  private var visibleSwipeDirection: WatchSwipeDirection? {
    if let pendingSwipeDirection { return pendingSwipeDirection }

    if dragAxis == .horizontal {
      if dragOffset.width < 0 { return .nextSet }
      if dragOffset.width > 0 { return .previousSet }
    }
    if dragAxis == .vertical {
      if dragOffset.height < 0 { return .nextExercise }
      if dragOffset.height > 0 { return .previousExercise }
    }
    return nil
  }

  private func previewItem(
    for direction: WatchSwipeDirection
  ) -> WatchWorkoutItemSnapshot? {
    switch direction {
    case .previousSet:
      return store.snapshot.previousSet
    case .nextSet:
      return store.snapshot.nextSet
    case .previousExercise:
      return store.snapshot.previousExercise
    case .nextExercise:
      return store.snapshot.nextExercise
    }
  }

  private func previewOffset(
    for direction: WatchSwipeDirection,
    availableSize: CGSize
  ) -> CGSize {
    switch direction {
    case .previousSet:
      return CGSize(width: dragOffset.width - availableSize.width, height: 0)
    case .nextSet:
      return CGSize(width: dragOffset.width + availableSize.width, height: 0)
    case .previousExercise:
      return CGSize(width: 0, height: dragOffset.height - availableSize.height)
    case .nextExercise:
      return CGSize(width: 0, height: dragOffset.height + availableSize.height)
    }
  }

  private func snapGesture(availableSize: CGSize) -> some Gesture {
    DragGesture(minimumDistance: 8)
      .onChanged { value in
        let axis = dragAxis ?? dominantAxis(for: value.translation)
        dragAxis = axis
        dragOffset = clampedOffset(
          for: value.translation,
          axis: axis,
          availableSize: availableSize
        )
      }
      .onEnded { value in
        let axis = dragAxis ?? dominantAxis(for: value.translation)
        dragAxis = nil

        guard let direction = committedSwipeDirection(for: value, axis: axis),
          previewItem(for: direction) != nil else {
          withAnimation(.spring(response: 0.24, dampingFraction: 0.86)) {
            dragOffset = .zero
          }
          return
        }

        animateSnap(direction, availableSize: availableSize)
      }
  }

  private func dominantAxis(for translation: CGSize) -> WatchDragAxis {
    abs(translation.width) >= abs(translation.height) ? .horizontal : .vertical
  }

  private func clampedOffset(
    for translation: CGSize,
    axis: WatchDragAxis,
    availableSize: CGSize
  ) -> CGSize {
    switch axis {
    case .horizontal:
      let limit = max(availableSize.width * 0.82, 1)
      return CGSize(width: clamp(translation.width, min: -limit, max: limit), height: 0)
    case .vertical:
      let limit = max(availableSize.height * 0.82, 1)
      return CGSize(width: 0, height: clamp(translation.height, min: -limit, max: limit))
    }
  }

  private func committedSwipeDirection(
    for value: DragGesture.Value,
    axis: WatchDragAxis
  ) -> WatchSwipeDirection? {
    let threshold: CGFloat = 34
    let translation = value.translation
    let predicted = value.predictedEndTranslation

    switch axis {
    case .horizontal:
      let distance = abs(translation.width)
      let projectedDistance = abs(predicted.width)
      guard distance >= threshold || projectedDistance >= threshold * 1.45 else {
        return nil
      }
      return translation.width < 0 ? .nextSet : .previousSet
    case .vertical:
      let distance = abs(translation.height)
      let projectedDistance = abs(predicted.height)
      guard distance >= threshold || projectedDistance >= threshold * 1.45 else {
        return nil
      }
      return translation.height < 0 ? .nextExercise : .previousExercise
    }
  }

  private func animateSnap(_ direction: WatchSwipeDirection, availableSize: CGSize) {
    pendingSwipeDirection = direction

    withAnimation(.easeOut(duration: 0.14)) {
      dragOffset = offscreenOffset(for: direction, availableSize: availableSize)
    }

    DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
      sendNavigationCommand(for: direction)
    }

    DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
      guard pendingSwipeDirection == direction else { return }
      resetCompletedSnap()
    }
  }

  private func resetCompletedSnap() {
    guard dragOffset != .zero || pendingSwipeDirection != nil else { return }
    pendingSwipeDirection = nil
    withAnimation(.spring(response: 0.24, dampingFraction: 0.86)) {
      dragOffset = .zero
    }
  }

  private func offscreenOffset(
    for direction: WatchSwipeDirection,
    availableSize: CGSize
  ) -> CGSize {
    switch direction {
    case .previousSet:
      return CGSize(width: availableSize.width, height: 0)
    case .nextSet:
      return CGSize(width: -availableSize.width, height: 0)
    case .previousExercise:
      return CGSize(width: 0, height: availableSize.height)
    case .nextExercise:
      return CGSize(width: 0, height: -availableSize.height)
    }
  }

  private func sendNavigationCommand(for direction: WatchSwipeDirection) {
    switch direction {
    case .previousSet:
      store.navigateSet(direction: "previous")
    case .nextSet:
      store.navigateSet(direction: "next")
    case .previousExercise:
      store.navigateExercise(direction: "previous")
    case .nextExercise:
      store.navigateExercise(direction: "next")
    }
  }

  private func clamp(_ value: CGFloat, min minimum: CGFloat, max maximum: CGFloat) -> CGFloat {
    Swift.min(Swift.max(value, minimum), maximum)
  }
}
