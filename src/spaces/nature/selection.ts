import { selectObject, useExperienceStore } from "../store";
export function inspectNatureObject(id: string | null) {
  const state = useExperienceStore.getState();
  if (state.tab === "tools")
    useExperienceStore.setState({
      selectedId: id,
      inspectionRequest: state.inspectionRequest + 1,
    });
  else selectObject(id);
}
