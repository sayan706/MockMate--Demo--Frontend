import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Environment, ContactShadows, Stars } from '@react-three/drei';

function AnimatedTitle() {
  const textRef = useRef();
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useFrame((state) => {
    if (textRef.current) {
      // Gentle floating and rotating
      textRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.2;
      textRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={textRef}>
      <Text
        fontSize={isMobile ? 1.8 : 3}
        letterSpacing={-0.05}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={isMobile ? 0.03 : 0.05}
        outlineColor="#6366f1"
      >
        MockMate
        <meshPhysicalMaterial 
          clearcoat={1} 
          clearcoatRoughness={0.1} 
          metalness={0.5} 
          roughness={0.2} 
          color="#ffffff"
          emissive="#6366f1"
          emissiveIntensity={0.2}
        />
      </Text>
    </group>
  );
}

export default function Hero() {
  return (
    <div style={{ height: '50vh', width: '100%', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
          <AnimatedTitle />
        </Float>
        
        <Environment preset="city" />
        <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
      </Canvas>
      <div style={{
        position: 'absolute',
        bottom: '20px',
        width: '100%',
        textAlign: 'center',
        pointerEvents: 'none'
      }}>
        <p style={{ 
          fontSize: '1.2rem', 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '4px'
        }}>
          AI Interviewer
        </p>
      </div>
    </div>
  );
}
