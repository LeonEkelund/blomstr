/*
  What the glass is glass over.

  Three fixed layers behind the whole page: a wash of colour, and two fields of
  small marks at different gauges. Fixed rather than scrolling, so the page
  slides across them — every translucent panel refracts something different as
  it travels, which is motion without a single animated frame. Animating
  anything under a large `backdrop-filter` re-rasterises the blur across the
  whole panel every frame, and this gets the same aliveness for free.

  The mark layers are what make the blur legible. A pure gradient behind glass
  still reads as flat colour; structure at a gauge wider than the 20px blur
  radius survives it as a soft shimmer, and that shimmer is the whole cue that
  there is something back there.
*/
export function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient-wash" />
      <div className="ambient-marks ambient-marks-fine" />
      <div className="ambient-marks ambient-marks-coarse" />
    </div>
  )
}
