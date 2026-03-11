// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
import "./styles/globals.css";

mount(() => <StartClient />, document.getElementById("app")!);
