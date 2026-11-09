import { useAppStore } from "@/app/store";
import { AppearanceSettings } from "@/ui/AppearanceSettings";
import { ProfileButton } from "@/ui/Spaces";
import { Icon } from "@/ui/Icon";
import styles from "./IconButtons.module.css";

export function IconButtons() {
  const theme = useAppStore((s) => s.theme), toggle = useAppStore((s) => s.toggleTheme);
  const dark = theme === "dark";
  return <>
    <button type="button" className={styles.btn} title={dark ? "Passa al tema chiaro" : "Passa al tema scuro"} aria-label={dark ? "Passa al tema chiaro" : "Passa al tema scuro"} aria-pressed={dark} onClick={toggle}><Icon name={dark ? "sun" : "moon"} /></button>
    <ProfileButton />
    <AppearanceSettings />
  </>;
}
