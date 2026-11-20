/* A single light spatial stage; decorative surfaces never imply task evidence. */
export function arenaBackground() {
  return `<div class="ps-range-backdrop" aria-hidden="true">
    <div class="ps-range-canopy"></div>
    <div class="ps-range-chamber"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="ps-range-platform"><div class="ps-range-platform-inner"></div><i class="ps-range-platform-signal"></i></div>
    <div class="ps-range-horizon"></div>
    <div class="ps-range-sparks"><i></i><i></i><i></i><i></i><i></i></div>
  </div>`;
}
