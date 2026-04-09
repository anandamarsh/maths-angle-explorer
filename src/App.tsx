import ArcadeAngleScreen from "./screens/ArcadeAngleScreen";
import RotatePrompt from "./components/RotatePrompt";
import { I18nProvider } from "./i18n";
import { installEmbeddedStorageBridge } from "./utils/embeddedStorageBridge";
import { useEffect } from "react";

export default function App() {
  useEffect(() => installEmbeddedStorageBridge(), []);

  return (
    <I18nProvider>
      <RotatePrompt />
      <ArcadeAngleScreen />
    </I18nProvider>
  );
}
