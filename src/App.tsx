import ArcadeAngleScreen from "./screens/ArcadeAngleScreen";
// @ts-expect-error — JS component, no types needed
import Social from "./components/Social";

export default function App() {
  return (
    <div>
      <ArcadeAngleScreen />
      <Social />
    </div>
  );
}
