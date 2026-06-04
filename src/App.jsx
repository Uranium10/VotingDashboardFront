import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from "@react-three/drei"
import { Vector3, Vector4 } from 'three';
import * as THREE from 'three'
import KoreaMap from './KoreaMap';
import './App.css'
import { transition } from 'three/examples/jsm/tsl/display/TransitionNode.js';

// import {
//   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
//   ResponsiveContainer, ComposedChart, Area, Line,
//   ErrorBar, Cell, LabelList, ReferenceLine, Legend,
// } from 'recharts';
import ChartUI from './ChartUI'


function App() {
  const tabNames = ["7회", "8회", "9회"];
  const [ backBut, setBackBut ] = useState(0);  // 뒤로가기 버튼이 존재하는, 보통 mode = 1의 상태
  const backButPress = useRef();
  const [ location, setLocation ] = useState(""); // 선택된 지역 이름. 있으면 보통 모드 1
  const [ round, setRound ] = useState(0);  // 경선 회차
  
  // 클릭 지역 정보를 담은 ref 컨트롤러 
  // mode:
  // 0: 지도 전체를 비추고, 카메라가 마우스 추적
  // 1: 특정 구역 확대
  // 2: 확대 해제, 자동 복귀. 
  // TP : 중심 위치, focusRegion: 이름, offFocus: 전부 할당 해제 플래그(프레임 기반)
  const cRigControl = useRef({
    mode: 0,
    TP : new Vector3(),
    focusRegion: [],
    offFocus: false,
  }); 
  function pressBackBut(e){
    setBackBut(0);
    cRigControl.current.offFocus = true;
    cRigControl.current.mode = 2;
    // mapGeoCanvas->camera에 신호를 줘야 한다. 어떻게?
  }
  useEffect(()=>{
    if (!backBut) return;
    
  }, [backBut])
  return (
    <div style={{width: "100vw", height: "100vh", position: "relative" }}>
        {/* 상단 탭 */}
          <TabBar backBut={backBut} setRound={setRound}/>
        {/* 3D 파트 */}
          <MapGeoCanvas 
            setBackBut={setBackBut}
            cRigControl={cRigControl} 
            setLoc={setLocation}
            round={round} // 숫자로 넘겨줘야 접근이 편하니 숫자로
            />

        {/* 3D 보조 UI */}
        { backBut == 1 &&
          <button 
            className='back-but'
            key={`backbutstate${backBut}`} 
            onClick={(e)=>{
              pressBackBut(e)
              }}>
            {"×"}
          </button>
        }
        <ChartUI 
          backBut={backBut} 
          control={cRigControl} 
          loc={location} 
          round={tabNames[round]}  // fetch로 쿼리해야하니 문자열로
        />
    </div>
  );
}
export default App

function TabBar({backBut, setRound}){
  const tabNames = ["7회", "8회", "9회"];
  const tabSubNames = ["2018년 6월 13일", "2022년 6월 1일", "2026년 6월 3일"]
  // 각 탭의 버튼 DOM
  const tabsDOM = useRef([]);
  // 인디케이터에 적용할 스타일. 활성화된 탭을 따라감, 덮어씌울 속성만 적을것
  const [ indStyle, setIndStyle ] = useState({transform:'translateX(0px)', left:0, width:0});
  // 활성화된 탭 번호
  const [ activeTab, setActiveTab ] = useState(0);
  useEffect(()=>{
    function setInd (){
      if (!tabsDOM) return;
      const curTab = tabsDOM.current[activeTab];
      setRound(activeTab);
      if (!curTab) return;
      // 바뀌는 속성만 적기
      setIndStyle({
        transform: `translateX(${curTab.offsetLeft}px)`,
        width: `${curTab.offsetWidth}px`,
      });
    }
    setInd();
    
    window.addEventListener('resize', setInd);
    return () => {
      window.removeEventListener('resize', setInd);
    }
  }, [activeTab]);
  return (
    <div className={`tab-ui${ backBut==1 ? " active" : "" }`}>
      <div className='tab-title'>
        전국동시지방선거 대시보드
      </div>
      <div className='tab-bar'>
        {tabNames.map((tab, index)=>(
          <button 
            key={tab + index} 
            // class 속성은 공백으로 다중 클래스 지정 가능.
            // active를 다중 클래스로 지정하는 것으로 css의 해당 속성을 불러옴
            className={`tab-but ${activeTab === index ? "select" : ""}`}
            // 인디케이터가 해당 버튼을 추적 가능하게 등록
            ref={(el)=>(tabsDOM.current[index] = el)}
            onClick={() => setActiveTab(index)}
          >
            <span className={`main-tab ${activeTab === index ? "select" : ""}`}>{tabNames[index]}</span>
            <span className="sub-tab">{tabSubNames[index]}</span>
          </button>
        ))}
        <div className='tab-indicator' style={indStyle}>  
        </div>
      </div>
    </div>
  );
}

// React.memo를 사용하여 Canvas와 UI를 분리할 수 있다.
// 이는 UI를 State등으로 리프레시할 때, 캔버스의 리로딩을 막아 최적화한다.
const MapGeoCanvas = React.memo(({setBackBut, cRigControl, setLoc, round}) => {
  const sceneColor = "#e0e7ee"
  const focusRegion = useRef();

  const initCamPos = new Vector3(0, 24, 10);
  const initCamLookAt = new Vector3(0, 0, 0);
  const initCamDir = new Vector3().subVectors(initCamLookAt, initCamPos);

  function onRegionClick(region, coord){
    console.log(region, coord);
    focusRegion.current = [region, coord];
    cRigControl.current.TP.fromArray(coord);
    cRigControl.current.mode = 1;
    cRigControl.current.focusRegion = [region];
    setLoc(region);
    setBackBut(1);
  }
  return (
    <div className='GeoCanvasDiv' key={"geocnv"}>
      <Canvas camera={{position: [0, 24, 10], fov: 60}}>
        <color attach="background" args={[sceneColor]} />
        <fog attach="fog" args={[sceneColor, 40, 100]} />
        <ambientLight intensity={3} />
        {/*바닥*/}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={'#6295f3'}/>
        </mesh>
        {/*지도*/}
        <group rotation={[-Math.PI / 2, 0, 0]} position={[-10, 0.1, -12]}>
          <KoreaMap onRegionClick={(region, coord) => {
                  onRegionClick(region, coord);
          }} control={cRigControl} round={round}/>
        </group>
          {/* 함수형 컴포넌트엔 ref를 달 수 없다. */}
          <CameraRig control={cRigControl} SP={initCamPos} SR={initCamLookAt}/>
      </Canvas>
    </div>
  );
});
/**
 * ref : 컨트롤러
 *  mode : 캠모드 - 0: 오버뷰, 1: 클로즈업
 * SP : StartPos - 원래 캠 위치
 * SR : StartRotation - 원래 보던 곳
 */
function CameraRig({control, SP, SR}){
  const targetPos = new Vector3();
  // 바라볼 위치
  const targetDir = useRef(new Vector3());
  // 현재 바라보는 위치
  const lookDir = useRef(new Vector3());
  // targetPos에 이 값을 더하면 바라볼 위치가 나옴
  const lookOffset = new Vector3(0, -2, -12);
  useFrame((state, delta) => {
    // 오버뷰
    if (control.current.mode == 0){
      
      // state.pointer엔 화면상 마우스 좌표가 NDC정규 좌표계(-1 ~ 1)로 정규화되어 들어있다.
      const scalar = 1.5
      const tX = state.pointer.x * scalar;
      const tZ = state.pointer.y * scalar;

      state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, tX, 0.05);
      state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, -tZ + 10, 0.05);
    }
    // 지역 클릭시 클로즈업
    else if (control.current.mode == 1){
      targetPos.set(control.current.TP.x,
          control.current.TP.y + 2,
          control.current.TP.z + 8);
      state.camera.position.lerp(targetPos, 0.05);
      // rotation은 오일러 공식을 쓰며, lerp가 존재하지 않는다.
      //state.camera.lookAt()
      targetDir.current.addVectors(targetPos, lookOffset);
      lookDir.current.lerp(targetDir.current, 0.05);
      state.camera.lookAt(lookDir.current);
    }
    else if (control.current.mode == 2){
      if (!targetPos.equals(SP))
        targetPos.copy(SP);
      state.camera.position.lerp(targetPos, 0.05);
      lookDir.current.lerp(SR, 0.05);
      state.camera.lookAt(lookDir.current);

      if (state.camera.position.distanceToSquared(SP) < 0.01 
      && lookDir.current.distanceToSquared(SR) < 0.01)
        control.current.mode = 0;
    }
  });
  return null;
}

// function ChartUI({ backBut, control, loc, round}){
//   function active(){
//     if (backBut == 1)
//       return 'chart-container active';
//     else
//       return 'chart-container';
//   }
//   return (
//     <div className={active()} >
//       <div className='chart-ui'>
//         <div className='chart-panel chart-local'>
//           <div className='chart-title'>
//             {(loc) &&
//               <span>{loc}</span>
//               }
//               <span>{`${round} 경선 ${round=="9회"? "(예측)": ""}`}</span>
//           </div>
//         </div>
//         <div className='chart-panel chart-global'>
//           <div className='chart-title' style={{backgroundColor: '#333333'}}>
//             {<span>전국 데이터</span>}
//           </div>
//           <ElectionBarChart />
//         </div>
//       </div>
//     </div>
//   )
// }

// // 내일 백엔드에서 날아올 JSON 데이터의 예상 형태 (더미 데이터)
// const dummyData = [
//   { name: '20대', 더불어민주당: 45, 국민의힘: 30, 정의당: 10 },
//   { name: '30대', 더불어민주당: 50, 국민의힘: 25, 정의당: 5 },
//   { name: '40대', 더불어민주당: 55, 국민의힘: 20, 정의당: 5 },
//   { name: '50대', 더불어민주당: 40, 국민의힘: 45, 정의당: 2 },
//   { name: '60대 이상', 더불어민주당: 30, 국민의힘: 60, 정의당: 1 },
// ];

// function ElectionBarChart() {
//   return (
//     // 부모(.chart-panel) 크기에 맞춰 100% 꽉 채우도록 설정
//     <div style={{ width: '60vw', height: '100%', minHeight: '300px', backgroundColor: '#ffffff'}}>
//       <ResponsiveContainer width="100%" height="100%">
//         <BarChart
//           data={dummyData}
//           margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
//         >
//           {/* 배경 점선 (디테일) */}
//           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
          
//           <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 12 }} />
//           <YAxis tick={{ fill: '#666', fontSize: 12 }} />
          
//           {/* 마우스 올리면 뜨는 정보창 */}
//           <Tooltip 
//             cursor={{ fill: 'rgba(0,0,0,0.05)' }}
//             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
//           />
          
//           {/* 막대기들 (radius 배열로 위쪽 모서리만 둥글게 깎아줍니다) */}
//           <Bar dataKey="더불어민주당" fill="#004ea2" radius={[4, 4, 0, 0]} />
//           <Bar dataKey="국민의힘" fill="#e61e2b" radius={[4, 4, 0, 0]} />
//           <Bar dataKey="정의당" fill="#ffcc00" radius={[4, 4, 0, 0]} />
//         </BarChart>
//       </ResponsiveContainer>
//     </div>
//   );
// }
