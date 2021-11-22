import React from "react";
import { Component, TRUC } from "./Component";
import { Component2 } from "./Component2";

export default function App() {
  return (
    <div>
      <h1>Test {TRUC}</h1>
      <Component />
      <Component2 />
    </div>
  );
}
