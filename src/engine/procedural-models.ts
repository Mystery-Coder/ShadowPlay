/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ShapeType } from '../types';

/**
 * Creates procedural 3D objects with proper bottom-centered pivots and
 * composite 3-12 part groups per Three.js design guidelines.
 */
export function createObjectMesh(shape: ShapeType, colorHex: string = '#cbd5e1'): THREE.Group {
  const group = new THREE.Group();
  group.name = `Shape_${shape}`;

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.35,
    metalness: 0.15,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex).multiplyScalar(0.75),
    roughness: 0.2,
    metalness: 0.6,
  });

  switch (shape) {
    case 'cube': {
      // 3-part composite: Main beveled box + rim frame + top accent plate
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = 0.5;
      group.add(mesh);

      // Accent border
      const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.8), accentMaterial);
      topPlate.castShadow = true;
      topPlate.position.y = 1.025;
      group.add(topPlate);
      break;
    }

    case 'sphere': {
      // 3-part: Spherical core + equatorial ring + mounting base
      const sphereGeo = new THREE.SphereGeometry(0.6, 32, 24);
      const mesh = new THREE.Mesh(sphereGeo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = 0.6;
      group.add(mesh);

      const ringGeo = new THREE.TorusGeometry(0.62, 0.04, 16, 32);
      const ring = new THREE.Mesh(ringGeo, accentMaterial);
      ring.castShadow = true;
      ring.position.y = 0.6;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      break;
    }

    case 'cylinder': {
      // 3-part: Main fluted cylinder + bottom base rim + top cap
      const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32);
      const mesh = new THREE.Mesh(cylGeo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = 0.6;
      group.add(mesh);

      const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.08, 32), accentMaterial);
      topCap.castShadow = true;
      topCap.position.y = 1.22;
      group.add(topCap);

      const baseRim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.08, 32), accentMaterial);
      baseRim.castShadow = true;
      baseRim.position.y = 0.04;
      group.add(baseRim);
      break;
    }

    case 'rod': {
      // Slender rod with metallic ferrules
      const rodGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.0, 24);
      const mesh = new THREE.Mesh(rodGeo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = 1.0;
      group.add(mesh);

      const ferrule1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.15, 24), accentMaterial);
      ferrule1.castShadow = true;
      ferrule1.position.y = 0.15;
      group.add(ferrule1);

      const ferrule2 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.15, 24), accentMaterial);
      ferrule2.castShadow = true;
      ferrule2.position.y = 1.85;
      group.add(ferrule2);
      break;
    }

    case 'ring': {
      // Torus ring with pivot mount
      const ringGeo = new THREE.TorusGeometry(0.65, 0.16, 24, 48);
      const mesh = new THREE.Mesh(ringGeo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = 0.75;
      group.add(mesh);

      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.25, 16), accentMaterial);
      stand.castShadow = true;
      stand.position.y = 0.12;
      group.add(stand);
      break;
    }

    case 'cone': {
      // Cone with flared base
      const coneGeo = new THREE.ConeGeometry(0.6, 1.4, 32);
      const mesh = new THREE.Mesh(coneGeo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = 0.7;
      group.add(mesh);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.68, 0.08, 32), accentMaterial);
      base.castShadow = true;
      base.position.y = 0.04;
      group.add(base);
      break;
    }

    case 'teapot': {
      // Composite Teapot (6 parts): Body, Spout, Handle, Lid, Lid Knob, Base
      // 1. Body: Squat sphere/cylinder
      const bodyGeo = new THREE.SphereGeometry(0.65, 32, 24);
      bodyGeo.scale(1.1, 0.85, 1.1);
      const body = new THREE.Mesh(bodyGeo, material);
      body.castShadow = true;
      body.position.y = 0.65;
      group.add(body);

      // 2. Base foot
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.12, 24), accentMaterial);
      foot.castShadow = true;
      foot.position.y = 0.06;
      group.add(foot);

      // 3. Spout: Angled cone tube
      const spoutGeo = new THREE.ConeGeometry(0.18, 0.7, 16);
      const spout = new THREE.Mesh(spoutGeo, material);
      spout.castShadow = true;
      spout.position.set(0.65, 0.72, 0);
      spout.rotation.z = -Math.PI / 3.2;
      group.add(spout);

      // 4. Handle: Torus segment
      const handleGeo = new THREE.TorusGeometry(0.38, 0.08, 16, 24, Math.PI * 1.2);
      const handle = new THREE.Mesh(handleGeo, accentMaterial);
      handle.castShadow = true;
      handle.position.set(-0.68, 0.68, 0);
      handle.rotation.z = Math.PI * 0.45;
      group.add(handle);

      // 5. Lid
      const lidGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.1, 24);
      const lid = new THREE.Mesh(lidGeo, material);
      lid.castShadow = true;
      lid.position.y = 1.15;
      group.add(lid);

      // 6. Knob
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), accentMaterial);
      knob.castShadow = true;
      knob.position.y = 1.25;
      group.add(knob);
      break;
    }

    case 'bird': {
      // Composite Bird in Flight (6 parts): Body, Left Wing, Right Wing, Tail, Neck, Beak
      // 1. Aerodynamic Body
      const bodyGeo = new THREE.ConeGeometry(0.24, 1.2, 16);
      bodyGeo.rotateX(Math.PI / 2);
      const body = new THREE.Mesh(bodyGeo, material);
      body.castShadow = true;
      body.position.set(0, 0.6, 0);
      group.add(body);

      // 2. Left Wing (swept prism)
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(0.9, 0.4);
      wingShape.lineTo(1.1, 0.2);
      wingShape.lineTo(0.3, -0.3);
      wingShape.closePath();
      const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false });
      wingGeo.rotateX(Math.PI / 2);

      const leftWing = new THREE.Mesh(wingGeo, material);
      leftWing.castShadow = true;
      leftWing.position.set(0.1, 0.62, 0.1);
      leftWing.rotation.z = -0.15;
      group.add(leftWing);

      // 3. Right Wing
      const rightWing = new THREE.Mesh(wingGeo, material);
      rightWing.castShadow = true;
      rightWing.scale.set(-1, 1, 1);
      rightWing.position.set(-0.1, 0.62, 0.1);
      rightWing.rotation.z = 0.15;
      group.add(rightWing);

      // 4. Tail fan
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.5), accentMaterial);
      tail.castShadow = true;
      tail.position.set(0, 0.6, -0.65);
      tail.rotation.x = -0.2;
      group.add(tail);

      // 5. Head & Beak
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), material);
      head.castShadow = true;
      head.position.set(0, 0.72, 0.65);
      group.add(head);

      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 12), accentMaterial);
      beak.castShadow = true;
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.7, 0.88);
      group.add(beak);
      break;
    }

    case 'chair': {
      // 6-part chair: Seat, 4 turned legs, backrest frame, horizontal slats
      // Seat
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.9), material);
      seat.castShadow = true;
      seat.position.y = 0.6;
      group.add(seat);

      // 4 legs
      const legGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.6, 16);
      const legOffsets = [
        [-0.38, -0.38],
        [0.38, -0.38],
        [-0.38, 0.38],
        [0.38, 0.38],
      ];
      legOffsets.forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, accentMaterial);
        leg.castShadow = true;
        leg.position.set(lx, 0.3, lz);
        group.add(leg);
      });

      // Backrest frame
      const backPostGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 16);
      const postL = new THREE.Mesh(backPostGeo, accentMaterial);
      postL.castShadow = true;
      postL.position.set(-0.38, 1.05, -0.38);
      group.add(postL);

      const postR = new THREE.Mesh(backPostGeo, accentMaterial);
      postR.castShadow = true;
      postR.position.set(0.38, 1.05, -0.38);
      group.add(postR);

      // Top rail
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.12, 0.06), material);
      rail.castShadow = true;
      rail.position.set(0, 1.45, -0.38);
      group.add(rail);

      // Middle spindle
      const spindle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.04), material);
      spindle.castShadow = true;
      spindle.position.set(0, 1.05, -0.38);
      group.add(spindle);
      break;
    }

    case 'key': {
      // Ornate skeleton key (5 parts): Bow ring, cross-clover, long fluted shaft, bit teeth
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 16, 32), material);
      bow.castShadow = true;
      bow.position.y = 1.6;
      group.add(bow);

      const cross = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), accentMaterial);
      cross.castShadow = true;
      cross.position.y = 1.6;
      group.add(cross);

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 16), material);
      shaft.castShadow = true;
      shaft.position.y = 0.8;
      group.add(shaft);

      const bit1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.06), accentMaterial);
      bit1.castShadow = true;
      bit1.position.set(0.16, 0.35, 0);
      group.add(bit1);

      const bit2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.06), accentMaterial);
      bit2.castShadow = true;
      bit2.position.set(0.21, 0.18, 0);
      group.add(bit2);
      break;
    }

    case 'arch': {
      // Classical Roman arch (4 parts): 2 Pillars, Keystone Arch, Base
      const pillarGeo = new THREE.BoxGeometry(0.28, 1.4, 0.35);
      const p1 = new THREE.Mesh(pillarGeo, material);
      p1.castShadow = true;
      p1.position.set(-0.6, 0.7, 0);
      group.add(p1);

      const p2 = new THREE.Mesh(pillarGeo, material);
      p2.castShadow = true;
      p2.position.set(0.6, 0.7, 0);
      group.add(p2);

      const archTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.4), material);
      archTop.castShadow = true;
      archTop.position.set(0, 1.5, 0);
      group.add(archTop);

      const keystone = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.44), accentMaterial);
      keystone.castShadow = true;
      keystone.position.set(0, 1.5, 0);
      group.add(keystone);
      break;
    }

    case 'spiral': {
      // Helical spiral curve
      const points: THREE.Vector3[] = [];
      const turns = 3.5;
      const count = 64;
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const angle = t * Math.PI * 2 * turns;
        const radius = 0.45;
        const y = t * 1.5 + 0.1;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.08, 12, false);
      const spiralMesh = new THREE.Mesh(tubeGeo, material);
      spiralMesh.castShadow = true;
      group.add(spiralMesh);

      // Central support rod
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 12), accentMaterial);
      core.castShadow = true;
      core.position.y = 0.8;
      group.add(core);
      break;
    }
  }

  // Set user data for raycasting & identification
  group.userData = {
    isStudioObject: true,
    shape,
  };

  return group;
}

/**
 * Creates a studio spotlight prop (stand, gimbal head, barn doors, and lens emitter).
 */
export function createSpotlightRigModel(colorHex: string = '#ffffff'): THREE.Group {
  const rig = new THREE.Group();
  rig.name = 'SpotlightRig';

  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.85,
  });

  const chrome = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.1,
    metalness: 0.95,
  });

  const lensGlow = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorHex),
  });

  // Base tripod ring
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.08, 24), darkMetal);
  base.position.y = 0.04;
  rig.add(base);

  // Telescopic stand pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 16), chrome);
  pole.position.y = 1.1;
  rig.add(pole);

  // Gimbal mount head
  const headGroup = new THREE.Group();
  headGroup.name = 'LightHead';
  headGroup.position.set(0, 2.2, 0);

  // Lamp casing cylinder
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.6, 24), darkMetal);
  casing.rotation.x = Math.PI / 2;
  headGroup.add(casing);

  // Front bezel ring
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 16, 24), chrome);
  bezel.position.set(0, 0, 0.3);
  headGroup.add(bezel);

  // Glowing emitter disc
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), lensGlow);
  lens.position.set(0, 0, 0.31);
  headGroup.add(lens);

  rig.add(headGroup);

  return rig;
}
