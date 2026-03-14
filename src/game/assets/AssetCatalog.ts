import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export class AssetCatalog {
  private readonly gltfLoader = new GLTFLoader();
  private readonly gltfCache = new Map<string, Promise<GLTF>>();

  loadGLB(path: string): Promise<GLTF> {
    let request = this.gltfCache.get(path);
    if (!request) {
      request = this.gltfLoader.loadAsync(path);
      this.gltfCache.set(path, request);
    }
    return request;
  }

  async loadOptionalScene(path: string): Promise<THREE.Object3D | null> {
    try {
      const gltf = await this.loadGLB(path);
      return gltf.scene.clone(true);
    } catch {
      return null;
    }
  }
}
