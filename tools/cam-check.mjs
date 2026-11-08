// 用于确认相机朝向：打印相机基向量在世界空间中的方向，确保画面布局与 Unity 一致。
import * as THREE from 'three';

const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 200);
cam.position.set(0, 13, -7);
cam.up.set(0, 1, 0);
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld(true);

const m = cam.matrixWorld;
const right = new THREE.Vector3().setFromMatrixColumn(m, 0);
const up = new THREE.Vector3().setFromMatrixColumn(m, 1);
const back = new THREE.Vector3().setFromMatrixColumn(m, 2);

const fmt = (v) => v.toArray().map((n) => n.toFixed(2)).join(', ');
console.log('camera right  (screen +X) =', fmt(right));
console.log('camera up     (screen +Y) =', fmt(up));
console.log('camera back   (toward viewer, +Z local) =', fmt(back));
