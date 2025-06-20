import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ARButton, GLTFLoader, OrbitControls } from 'three/examples/jsm/Addons.js';
import { Button } from "@/components/ui/button";

interface ArSceneProps {
  isCameraFlipped?: boolean;
}

export default function ArScene({ isCameraFlipped = false }: ArSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const markerRef = useRef<THREE.Group | null>(null);
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const hitTestSourceRequestedRef = useRef<boolean>(false);
  const referenceSpaceRef = useRef<XRReferenceSpace | null>(null);
  const controllerRef = useRef<THREE.XRTargetRaySpace | null>(null);
  const [isARSupported, setIsARSupported] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isARSessionActive, setIsARSessionActive] = useState<boolean>(false);

  const startARSession = async () => {
    if (!navigator.xr) {
      setErrorMessage('WebXR not available.');
      return;
    }
  
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'local-floor', 'bounded-floor'],
        domOverlay: { root: document.body },
      });
  
      if (rendererRef.current) {
        rendererRef.current.xr.setSession(session);
      }
  
      // Try different reference spaces in order of preference
      const referenceSpaceTypes = ['local-floor', 'bounded-floor', 'local', 'viewer'];
      let refSpace = null;
      
      for (const type of referenceSpaceTypes) {
        try {
          refSpace = await session.requestReferenceSpace(type as XRReferenceSpaceType);
          console.log(`Using reference space: ${type}`);
          break;
        } catch (e) {
          console.log(`Reference space ${type} not supported`);
        }
      }
      
      if (!refSpace) {
        throw new Error('No supported reference space found');
      }
      
      referenceSpaceRef.current = refSpace;
  
      try {
        if (typeof session.requestHitTestSource === 'function') {
          const source = await session.requestHitTestSource({
            space: refSpace,
          });
          if (source) {
            hitTestSourceRef.current = source;
            hitTestSourceRequestedRef.current = true;
          }
        }
      } catch (err) {
        console.error('Hit test source error:', err);
        setErrorMessage('Could not initialize hit testing. Some AR features may be limited.');
      }
    } catch (err) {
      console.error('Failed to start AR session:', err);
      setErrorMessage('Could not start AR session. Make sure your device supports WebXR.');
    }
  };

  const stopARSession = () => {
    if (rendererRef.current) {
      rendererRef.current.xr.getSession()?.end();
    }
  };

  useEffect(() => {
    // Check for WebXR support
    if ('xr' in navigator) {
      navigator.xr?.isSessionSupported('immersive-ar').then((supported) => {
        setIsARSupported(supported);
        if (!supported) {
          setErrorMessage('AR is not supported on your device. Please try on a mobile device with AR support.');
        }
      }).catch((error) => {
        console.error('Error checking AR support:', error);
        setErrorMessage('Error checking AR support. Please try on a different device or browser.');
      });
    } else {
      setErrorMessage('WebXR is not supported in your browser. Please try Chrome on Android or Safari on iOS.');
    }

    if (!containerRef.current) return;

    // Initialize scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Get container dimensions
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 0.1;
    cameraRef.current = camera;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add controller
    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);
    controllerRef.current = controller;

    // Create marker
    const markerGroup = new THREE.Group();
    
    // Create foot shape
    const footShape = new THREE.Shape();
    footShape.moveTo(0, 0);
    footShape.bezierCurveTo(0.1, 0, 0.2, 0.1, 0.2, 0.2); // Toe curve
    footShape.lineTo(0.2, 0.4); // Heel
    footShape.bezierCurveTo(0.2, 0.5, 0.1, 0.5, 0, 0.5); // Heel curve
    footShape.lineTo(0, 0); // Back to start

    // Create foot marker
    const footGeometry = new THREE.ShapeGeometry(footShape);
    const footMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const footMesh = new THREE.Mesh(footGeometry, footMaterial);
    footMesh.rotateX(-Math.PI / 2);
    footMesh.scale.set(0.2, 0.2, 0.2);
    markerGroup.add(footMesh);

    // Add outline
    const outlineGeometry = new THREE.EdgesGeometry(footGeometry);
    const outlineMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffffff,
      linewidth: 2
    });
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.rotateX(-Math.PI / 2);
    outline.scale.set(0.2, 0.2, 0.2);
    markerGroup.add(outline);

    // Add pulsing animation
    const pulseAnimation = () => {
      if (markerRef.current) {
        const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        markerRef.current.scale.set(scale, scale, scale);
        
        // Pulse opacity
        const opacity = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
        markerRef.current.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.opacity = opacity;
          }
        });
      }
    };

    markerGroup.visible = false;
    scene.add(markerGroup);
    markerRef.current = markerGroup;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Load 3D model
    const loader = new GLTFLoader();
    console.log('Starting to load model...');
    loader.load(
      '/model/sneaker.glb',
      (gltf) => {
        console.log('Model loaded, processing...');
        const model = gltf.scene;
        
        // Log model details
        console.log('Model details:', {
          position: model.position,
          scale: model.scale,
          visible: model.visible
        });

        // Set model properties
        model.scale.set(0.1, 0.1, 0.1);
        model.visible = true; // Start visible on main screen
        model.position.set(0, 0, 0);
        
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        
        // Add model to scene
        scene.add(model);
        modelRef.current = model;
        console.log('Model added to scene successfully');

        // Set up initial camera position for main screen view
        camera.position.set(0, 0, 1);
        camera.lookAt(0, 0, 0);
      },
      (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading model:', error);
      }
    );

    // Handle AR session
    renderer.xr.addEventListener('sessionstart', () => {
      console.log('AR session started');
      setIsARSessionActive(true);
      hitTestSourceRequestedRef.current = false;
      
      // Reset model visibility and position when AR starts
      if (modelRef.current) {
        console.log('Resetting model for AR session');
        modelRef.current.visible = false;
        modelRef.current.position.set(0, 0, -0.5);
      } else {
        console.warn('Model not available during AR session start');
      }
    });

    renderer.xr.addEventListener('sessionend', () => {
      console.log('AR session ended');
      setIsARSessionActive(false);
      if (modelRef.current) {
        // Return model to main screen view
        modelRef.current.visible = true;
        modelRef.current.position.set(0, 0, -0.5);
        modelRef.current.rotation.set(0, 0, 0);
        camera.position.set(0, 0, 1);
        camera.lookAt(0, 0, 0);
      }
      if (markerRef.current) {
        markerRef.current.visible = false;
      }
    });

    // Handle selection
    function onSelect() {
      console.log('Selection event triggered');
      if (modelRef.current && markerRef.current?.visible) {
        console.log('Placing model at marker position');
        // Copy position and rotation from marker
        modelRef.current.position.copy(markerRef.current.position);
        modelRef.current.quaternion.copy(markerRef.current.quaternion);
        
        // Make model visible and lift it slightly above the surface
        modelRef.current.visible = true;
        modelRef.current.position.y += 0.05;
        
        console.log('Model placed at:', {
          position: modelRef.current.position,
          rotation: modelRef.current.rotation,
          visible: modelRef.current.visible
        });
      } else {
        console.log('Cannot place model:', {
          modelExists: !!modelRef.current,
          markerVisible: markerRef.current?.visible
        });
      }
    }

    // Handle hit testing
    const onXRFrame = (time: number, frame: XRFrame) => {
      if (hitTestSourceRef.current && markerRef.current && referenceSpaceRef.current) {
        const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          const pose = hit.getPose(referenceSpaceRef.current);
          if (pose) {
            markerRef.current.visible = true;
            markerRef.current.matrix.fromArray(pose.transform.matrix);
            pulseAnimation();
          }
        } else {
          markerRef.current.visible = false;
        }
      }
    };

    // Add debug controls for testing
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enabled = !isARSessionActive; // Disable controls during AR

    renderer.setAnimationLoop((time, frame) => {
      if (frame) onXRFrame(time, frame);
      if (!isARSessionActive) {
        controls.update();
      }
      renderer.render(scene, camera);
    });

    // Handle window resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (controllerRef.current) {
        controllerRef.current.removeEventListener('select', onSelect);
      }
      if (containerRef.current && rendererRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, [isCameraFlipped, isARSupported]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1,
        overflow: 'hidden'
      }}
    >
      {isARSupported && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2
        }}>
          <Button
            onClick={isARSessionActive ? stopARSession : startARSession}
            variant={isARSessionActive ? "destructive" : "default"}
            size="lg"
            className="px-8 py-6 text-lg font-semibold"
          >
            {isARSessionActive ? 'Stop AR' : 'Start AR'}
          </Button>
        </div>
      )}
      {errorMessage && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          textAlign: 'center',
          maxWidth: '80%',
          zIndex: 2
        }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}