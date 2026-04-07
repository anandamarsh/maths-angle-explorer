import ArcadeAngleScreen from "./screens/ArcadeAngleScreen";
import RotatePrompt from "./components/RotatePrompt";
import { I18nProvider } from "./i18n";

export default function App() {
  return (
    <I18nProvider>
      <RotatePrompt />
      <ArcadeAngleScreen />
    </I18nProvider>
  );
}
