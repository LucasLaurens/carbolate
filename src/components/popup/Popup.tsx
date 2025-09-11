import { Component } from "react";
import PerformanceEvent from "../../events/performance_event";

export default class Popup extends Component {
  handle = () => {
    console.log("handle");
  };

  render() {
    return (
      <div style={{ padding: "10px", fontFamily: "sans-serif" }}>
        <h1>Carbolate 👋</h1>
        <p>Calculate your carbon footprint on the web.</p>
        <button onClick={this.handle}>
          déclancher l'evenement
        </button>
      </div>
    );
  }
}