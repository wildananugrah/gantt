// Wrapped so Vite code-splits Excalidraw (including its CSS) into its own chunk.
import '@excalidraw/excalidraw/index.css';
import { Excalidraw } from '@excalidraw/excalidraw';

export default Excalidraw;
