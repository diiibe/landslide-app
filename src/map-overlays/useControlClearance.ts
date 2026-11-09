import { useLayoutEffect, type RefObject } from "react";

type Rect = { left: number; right: number; top: number; bottom: number; height: number };
/** Reserve only obstructions in the same horizontal strip as the control. */
export function bottomClearance(map: Rect, control: Rect, blockers: Rect[]): number {
  return Math.ceil(Math.max(16, ...blockers
    .filter(b => b.height > 0 && b.top < map.bottom && b.right > control.left && b.left < control.right + 8)
    .map(b => map.bottom - b.top + 8)));
}
export function useControlClearance(ref: RefObject<HTMLDivElement>, drawerOpen: boolean, drawing: boolean) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let frame = 0, observed: Element | null = null;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    function measure() {
      if (!root) return;
      const control = root.querySelector<HTMLElement>('[data-map-3d]');
      const attribution = root.querySelector<HTMLElement>('.maplibregl-ctrl-attrib');
      if (attribution !== observed) {
        if (observed) resize?.unobserve(observed);
        observed = attribution;
        if (observed) resize?.observe(observed);
      }
      if (!control) return;
      const map = root.getBoundingClientRect();
      if (map.height <= 0) return;
      const blockers = attribution ? [attribution.getBoundingClientRect()] : [];
      const drawer = document.getElementById('drawer-panel');
      if (drawerOpen && !drawing && drawer) blockers.push(drawer.getBoundingClientRect());
      const edge = bottomClearance(map, control.getBoundingClientRect(), blockers);
      const value = `${edge}px`;
      if (root.style.getPropertyValue('--map-control-bottom') !== value) root.style.setProperty('--map-control-bottom', value);
      // The legend stays above attribution text when it occupies the left edge.
      const legend = root.querySelector<HTMLElement>('[data-map-legend]');
      const legendEdge = attribution && legend ? bottomClearance(map, legend.getBoundingClientRect(), [attribution.getBoundingClientRect()]) : 16;
      root.style.setProperty('--map-legend-bottom', `${Math.min(Math.max(68, legendEdge + 52), Math.max(16, map.height - 60))}px`);
    }
    resize?.observe(root);
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    measure();
    return () => { cancelAnimationFrame(frame); resize?.disconnect(); mutations.disconnect(); window.removeEventListener('resize', schedule); };
  }, [ref, drawerOpen, drawing]);
}
