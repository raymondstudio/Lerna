"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function Robot() {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const eyeRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    // Make the entire robot follow the mouse cursor gently
    if (groupRef.current) {
      // Smooth look-at mouse
      const targetX = (state.pointer.x * state.viewport.width) / 4;
      const targetY = (state.pointer.y * state.viewport.height) / 4;
      
      // We want the robot to look at the cursor
      const target = new THREE.Vector3(targetX, targetY, 5);
      groupRef.current.lookAt(target);
      
      // Add a slight tilt based on mouse position
      groupRef.current.rotation.z = -state.pointer.x * 0.2;
      groupRef.current.rotation.x += state.pointer.y * 0.1;
    }
    
    // Animate the eye scale (pulsing effect)
    if (eyeRef.current) {
      const scale = 1 + Math.sin(time * 3) * 0.05;
      eyeRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <Float
      speed={2} // Animation speed
      rotationIntensity={0.5} // XYZ rotation intensity
      floatIntensity={1.5} // Up/down float intensity
      floatingRange={[-0.2, 0.2]} // Range of y-axis values
    >
      <group ref={groupRef}>
        {/* Main Body (Capsule) */}
        <mesh position={[0, -0.5, 0]}>
          <capsuleGeometry args={[0.8, 1.5, 4, 32]} />
          <meshStandardMaterial 
            color="#08152e" 
            metalness={0.9} 
            roughness={0.1} 
            envMapIntensity={2}
          />
        </mesh>
        
        {/* Neck ring */}
        <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.1, 16, 32]} />
          <meshStandardMaterial color="#4fd1c5" metalness={0.8} roughness={0.2} emissive="#06b6d4" emissiveIntensity={0.5} />
        </mesh>

        {/* Head */}
        <mesh ref={headRef} position={[0, 1.3, 0]}>
          <sphereGeometry args={[0.7, 64, 64]} />
          <meshStandardMaterial 
            color="#0a1930" 
            metalness={1.0} 
            roughness={0.05} 
            envMapIntensity={2.5}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </mesh>

        {/* Visor/Eye area */}
        <mesh position={[0, 1.4, 0.6]} rotation={[0, 0, 0]}>
          <capsuleGeometry args={[0.2, 0.6, 4, 32]} />
          <meshStandardMaterial color="#000000" metalness={0.8} roughness={0.1} />
        </mesh>

        {/* Glowing Eye */}
        <mesh ref={eyeRef} position={[0, 1.4, 0.75]}>
          <sphereGeometry args={[0.12, 32, 32]} />
          <meshStandardMaterial 
            color="#ffffff" 
            emissive="#06b6d4" 
            emissiveIntensity={3} 
            toneMapped={false} 
          />
        </mesh>

        {/* Floating Side Orbs (Hands/Modules) */}
        <mesh position={[-1.4, -0.2, 0]}>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color="#172554" metalness={0.8} roughness={0.15} envMapIntensity={1.5} />
        </mesh>
        <mesh position={[1.4, -0.2, 0]}>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color="#172554" metalness={0.8} roughness={0.15} envMapIntensity={1.5} />
        </mesh>
        
        {/* Energy connectors */}
        <mesh position={[-1, -0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={2} />
        </mesh>
        <mesh position={[1, -0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={2} />
        </mesh>
      </group>
    </Float>
  );
}

export function RobotCanvas() {
  return (
    <div className="w-full h-full relative z-10 pointer-events-auto">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#06b6d4" />
        <pointLight position={[0, 2, 5]} intensity={1} color="#06b6d4" />
        
        {/* High quality environment map for metallic reflections */}
        <Environment preset="city" />
        
        <Robot />
        
        <ContactShadows 
          position={[0, -3.5, 0]} 
          opacity={0.4} 
          scale={10} 
          blur={2.5} 
          far={4} 
        />
      </Canvas>
    </div>
  );
}
