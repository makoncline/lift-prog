- [x] completion date time edit fix
- [ ] plate calculator
- [ ] logged out state on home page
- [ ] negative body weight modifier increments should decrease on progression.

## Move workout timing controls to finish dialog

Moved all workout timing controls (date, start time, end time, duration) from the main UI to the finish workout dialog. The main screen now only allows editing the workout title. Timing fields are populated with calculated values when the finish dialog opens, and these values are discarded if the workout is cancelled. The timing fields are interactive - editing duration updates start time, while editing start/end times updates duration.

## Plate calculator

its hard to calculate the weight to put on each side of a bar.
it would be easier if we could click a button to open a dialog with a table of standard bar weight along with what plates to add to each side of the bar.
lets start with just the stadard 20kg bar (45 lb) and the 15 kg bar at first.
the platees available are 45, 35, 25, 10, 5, 2.5
the same amount of plates must be added to ech side of the bar so its even.
