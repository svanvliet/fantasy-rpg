import * as THREE from "three";

interface StandardMaterialSpec {
  color: number;
  roughness?: number;
  metalness?: number;
  fog?: boolean;
  transparent?: boolean;
  opacity?: number;
  envMapIntensity?: number;
}

export class BlockoutFactory {
  private readonly boxGeometryCache = new Map<string, THREE.BoxGeometry>();
  private readonly cylinderGeometryCache = new Map<string, THREE.CylinderGeometry>();
  private readonly sphereGeometryCache = new Map<string, THREE.SphereGeometry>();
  private readonly torusGeometryCache = new Map<string, THREE.TorusGeometry>();
  private readonly standardMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
  private readonly basicMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

  createBoxMesh(scale: THREE.Vector3, materialSpec: StandardMaterialSpec): THREE.Mesh {
    return new THREE.Mesh(this.getBoxGeometry(scale), this.getStandardMaterial(materialSpec));
  }

  createCylinderMesh(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments: number,
    materialSpec: StandardMaterialSpec
  ): THREE.Mesh {
    return new THREE.Mesh(
      this.getCylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
      this.getStandardMaterial(materialSpec)
    );
  }

  createSphereMesh(
    radius: number,
    widthSegments: number,
    heightSegments: number,
    color: number
  ): THREE.Mesh {
    return new THREE.Mesh(
      this.getSphereGeometry(radius, widthSegments, heightSegments),
      this.getBasicMaterial(color)
    );
  }

  createTorusMesh(
    radius: number,
    tube: number,
    radialSegments: number,
    tubularSegments: number,
    arc: number,
    materialSpec: StandardMaterialSpec
  ): THREE.Mesh {
    return new THREE.Mesh(
      this.getTorusGeometry(radius, tube, radialSegments, tubularSegments, arc),
      this.getStandardMaterial(materialSpec)
    );
  }

  private getBoxGeometry(scale: THREE.Vector3): THREE.BoxGeometry {
    const key = `${scale.x}:${scale.y}:${scale.z}`;
    let geometry = this.boxGeometryCache.get(key);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(scale.x, scale.y, scale.z);
      this.boxGeometryCache.set(key, geometry);
    }
    return geometry;
  }

  private getCylinderGeometry(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments: number
  ): THREE.CylinderGeometry {
    const key = `${radiusTop}:${radiusBottom}:${height}:${radialSegments}`;
    let geometry = this.cylinderGeometryCache.get(key);
    if (!geometry) {
      geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
      this.cylinderGeometryCache.set(key, geometry);
    }
    return geometry;
  }

  private getSphereGeometry(
    radius: number,
    widthSegments: number,
    heightSegments: number
  ): THREE.SphereGeometry {
    const key = `${radius}:${widthSegments}:${heightSegments}`;
    let geometry = this.sphereGeometryCache.get(key);
    if (!geometry) {
      geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
      this.sphereGeometryCache.set(key, geometry);
    }
    return geometry;
  }

  private getTorusGeometry(
    radius: number,
    tube: number,
    radialSegments: number,
    tubularSegments: number,
    arc: number
  ): THREE.TorusGeometry {
    const key = `${radius}:${tube}:${radialSegments}:${tubularSegments}:${arc}`;
    let geometry = this.torusGeometryCache.get(key);
    if (!geometry) {
      geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments, arc);
      this.torusGeometryCache.set(key, geometry);
    }
    return geometry;
  }

  private getStandardMaterial(spec: StandardMaterialSpec): THREE.MeshStandardMaterial {
    const key = [
      spec.color,
      spec.roughness ?? 0.88,
      spec.metalness ?? 0.06,
      spec.fog ?? true,
      spec.transparent ?? false,
      spec.opacity ?? 1,
      spec.envMapIntensity ?? 0.4
    ].join(":");

    let material = this.standardMaterialCache.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: spec.color,
        roughness: spec.roughness ?? 0.88,
        metalness: spec.metalness ?? 0.06,
        fog: spec.fog ?? true,
        transparent: spec.transparent ?? false,
        opacity: spec.opacity ?? 1
      });
      material.envMapIntensity = spec.envMapIntensity ?? 0.4;
      this.standardMaterialCache.set(key, material);
    }
    return material;
  }

  private getBasicMaterial(color: number): THREE.MeshBasicMaterial {
    const key = `${color}`;
    let material = this.basicMaterialCache.get(key);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color });
      this.basicMaterialCache.set(key, material);
    }
    return material;
  }
}

export const blockoutFactory = new BlockoutFactory();
