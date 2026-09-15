/*
  What the glass is glass over.

  Two fixed fields of small marks at different gauges. Fixed rather than
  scrolling, so the page slides across them — every translucent panel refracts
  something different as it travels, which is motion without a single animated
  frame. Animating anything under a large `backdrop-filter` re-rasterises the
  blur across the whole panel every frame, and this gets the same aliveness for
  free.

  The marks are what make the blur legible, and now they are the whole field.
  The colour wash that used to sit under them is gone: a gradient behind glass
  reads as flat colour anyway, while structure at a gauge wider than the 20px
  blur radius survives it as a soft shimmer. That shimmer was always the cue
  that something was back there; the wash was only tinting it.
*/
export function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient-marks ambient-marks-fine" />
      <div className="ambient-marks ambient-marks-coarse" />
    </div>
  )
}
