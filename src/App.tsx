import "./App.css";
import Popup from "./components/popup/Popup";
import { createMetricsStore } from "./session/store";
import { ChromeStorage } from "./storage/ChromeStorage";
import { SystemClock } from "./utils/clock";

// Composition root of the panel: the only place that knows which concrete
// storage and clock the browser provides.
const clock = new SystemClock();
const store = createMetricsStore(ChromeStorage, clock);

export default function App() {
  return (
    <div className="flex justify-center w-full">
      <Popup store={store} storage={ChromeStorage} clock={clock} />
    </div>
  );
}
