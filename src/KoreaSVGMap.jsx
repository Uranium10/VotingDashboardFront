import React, { useMemo, useState, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { SVGLoader } from "three/examples/jsm/Addons.js";
import * as THREE from "three"
import { Edges, Line, Html } from "@react-three/drei";
import SouthKorea from "@svg-maps/south-korea";
import { RegionNameMap, Rating, PartyColors } from "./constants";
import './KoreaMap.css'

export default function KoreaSVGMap({ location, lName, onRegionClick, clicked, control, reg , round}) {
  // useMemo : 캐싱. 정점 파싱같은 무거운 작업에 할당
  // 의존성 배열[]엔 사용한 외부 변수를 꼭 넣어줘야 함.
  const shape = useMemo(() => {
    const loader = new SVGLoader();
    // 1. 원본 문자열을 완벽한 SVG 태그 형태로 조립해서 파싱합니다.
    const svgData = loader.parse(`<svg><path d="${location.path}"/></svg>`);
    
    const allShapes = [];
    // 2. 파싱된 데이터에서 ShapePath 객체들을 뽑아내어 createShapes에 넣습니다!
    svgData.paths.forEach((shapePath) => {
        // ...[]은 파이썬의 *[]과 같은 문법. 배열 안의 내용을 풀어서 넣는다.
      allShapes.push(...SVGLoader.createShapes(shapePath));
    });
    return allShapes;
  }, [location.path]);


  // 마우스를 올렸을 경우
  const hover = useRef(0);
  const g = useRef();
  // 매터리얼에 fog: false 옵션을 주면 안개가 미적용된다.
  const mat = useMemo(()=>new THREE.MeshStandardMaterial({color: "#ffffff", fog: false}), []);
  const baseColorHex = useMemo(() => {
    // '전체' 탭이거나 데이터가 없으면 기본 흰색
    if (round === 3 || !Rating[round] || !Rating[round][lName])
      return "#ffffff"; 
    const regionData = Rating[round][lName];
    const top1 = regionData.top1;
    const top2 = regionData.top2;
    const top3 = regionData.top3;

    const color1 = new THREE.Color(PartyColors[top1.party] || "#888888");

    // 2위 데이터가 있다면 색상을 비율만큼 섞습니다.
    if (top1.rate - top2.rate <= 4.0) {
      const color2 = new THREE.Color(PartyColors[top2.party] || "#888888");
      // 2위가 차지하는 비중 계산 (예: 40.2 / (44.1 + 40.2) ≈ 0.47)
      // * 0.8 정도의 가중치를 곱해주면 1위 정당의 색이 완전히 먹히는 것을 방지할 수 있습니다.
      const mixRatio = (top2.rate / 100) * 0.5; 
      color1.lerp(color2, mixRatio);
    }
    // if (top3) {
    //   const color3 = new THREE.Color(PartyColors[top3.party] || "#888888");
    //   // 2위가 차지하는 비중 계산 (예: 40.2 / (44.1 + 40.2) ≈ 0.47)
    //   // * 0.8 정도의 가중치를 곱해주면 1위 정당의 색이 완전히 먹히는 것을 방지할 수 있습니다.
    //   const mixRatio = (top3.rate / 100) * 0.05; 
    //   color1.lerp(color3, mixRatio);
    // }
    // 계산된 최종 색상의 Hex 코드를 반환합니다.
    return color1.getStyle();
  }, [round, lName]); // 회차가 바뀔 때만 재계산

  // 계산된 베이스 컬러를 기반으로 상태별(기본, 호버, 클릭) 색상을 생성합니다.
  const matCol = useMemo(() => 
    baseColorHex=="#ffffff" ?
    [
    new THREE.Color("#ffffff"), 
    new THREE.Color("#aaccff"),
    new THREE.Color("#88b7ff")] :
    [
    new THREE.Color(baseColorHex).offsetHSL(0, 0.2, 0), 
    new THREE.Color(baseColorHex).offsetHSL(0, 0.35, 0.2), // Hover
    new THREE.Color(baseColorHex).offsetHSL(0, 0.25, 0.2)  // Click
  ], [baseColorHex]);


  const coords = useRef();
  const targetC = useRef(matCol[0]);
  const hoverFuncs = {
        0: ()=> {targetC.current = matCol[0]},
        1: ()=> {targetC.current = matCol[1]},
        2: ()=>{
            if (lName != clicked.current){
                hover.current = 0;
                targetC.current = matCol[0];
            }
            else {
                targetC.current = matCol[2];
            }}};

  // 인디케이터
  const indRef = useRef();
  const labelRef = useRef();

  useFrame((state, delta)=>{
    if (!g.current) return;
    // 앞으로 튀어나오는 효과를 주고 싶다 -> 월드 y로 튀어나와야 함
    // 이 객체는 90도 누워있는 그룹에 묶여있음. 원래는 세워진 객체임
    // 여기서 z값을 변경해야 누워있는 상태에서 y값이 변경됨
    const targetZ = hover.current != 0 ? -0.5 : 0;
    

    hoverFuncs[hover.current]();
    g.current.position.z = THREE.MathUtils.damp(g.current.position.z, targetZ, 8.0, delta);
    if (!mat) return;
    // 색깔의 보간은 color속성의 lerp함수로 처리
    mat.color.lerp(targetC.current, 0.4);

    if (indRef.current){
      // const isActive = (lName == clicked.current)
      const isActive = (hover.current != 0)
      const targetScaleZ = isActive ? 1.2 : 0;
      indRef.current.scale.z = THREE.MathUtils.lerp(indRef.current.scale.z, targetScaleZ, 0.1);

      // ✨ 마법의 코드: 리렌더링 없이 매 프레임마다 active 클래스를 뗐다 붙였다 합니다!
      if (labelRef.current) {
        const hasActive = labelRef.current.classList.contains("active");
        
        if (isActive && !hasActive) {
          // 켜져야 하는데 안 켜져 있을 때만 추가
          labelRef.current.classList.add("active");
        } else if (!isActive && hasActive) {
          // 꺼져야 하는데 켜져 있을 때만 삭제
          labelRef.current.classList.remove("active");
        }
      }
    }
  });

  // 처음엔 return문 안의 렌더링 부분에서 ref=>함수 호출을 통해 바운더리 계산을 했지만,
  // 렌더링 부분의 내용들은 렌더 변화(색깔, 좌표등)가 일어날때마다 매 프레임 계산된다..
  useEffect(()=>{
    if (coords.current) return;
    const box = new THREE.Box3().setFromObject(g.current);
    const center = new THREE.Vector3();
    box.getCenter(center);
    coords.current = center.toArray();
    reg(lName, onClickSimul);
    // 플레인이 뒤집혀있으므로, 로컬 좌표계로 변환
    if (indRef.current){
      const localCenter = new THREE.Vector3().fromArray(coords.current);
      g.current.worldToLocal(localCenter);
      localCenter.z = -0.5;
      indRef.current.position.copy(localCenter);
    }
  }, [g])

  function onClicked(e){
    if (control.current.mode == 1) return;
    e.stopPropagation();
    clicked.current = lName;
    hover.current = 2;
    if (onRegionClick) onRegionClick(lName, coords.current);
  }

  // 키보드 포커스 변경을 위해 onclick기능을 시뮬
  function onClickSimul() {
    if (control.current.mode != 1) return;
    clicked.current = lName;
    hover.current = 2;
    if (onRegionClick) onRegionClick(lName, coords.current);
  }

  function onPointerOuted(e){
    e.stopPropagation();
    if (hover.current != 2)
        hover.current = 0;
    document.body.style.cursor = "default";
  }

  function onPointerOvered(e){
    e.stopPropagation();
    if (control.current.mode == 1) return;
    if (hover.current != 2)
        hover.current = 1;
    document.body.style.cursor = "pointer";
  }

  return (
    <group>
      <group
        ref={g}
        onPointerOver={(e)=>{onPointerOvered(e)}}
        onPointerOut={(e)=>onPointerOuted(e)}
        onClick={(e)=>onClicked(e)}
        >
        {/*해당 행정지역의 모든 도서지방 그리기*/}
        {shape.map((shape, index)=>(
            <mesh key={`mapKor${location.id}${index}`} material={mat}>
                <extrudeGeometry args={[shape, {depth: 0.3, bevelEnabled: false}]} />
                {/* wireframe=true말고, drei의 기능인 Edge를 써서 외곽선을 그린다*/}
                <Edges 
                    threshold={15}
                    color={"#3e8bff"}
                />
            </mesh>
        ))}
        </group>
        <group ref={indRef} scale={[1,1,0]}>
          <Line
              raycast={()=>null}
              points={[[0, 0, 0], [0, 0 , -1]]} // 시작점(바닥) ~ 끝점(라벨 바로 아래)
              color="#576ce3"
              lineWidth={3}     // 굵기
              dashed={true}     // 점선 모드 켜기
              dashScale={8}    // 점선 촘촘함
              dashSize={2}      // 점선 길이
              dashOffset={0}
            />
            {/** zIndexRange는 화면에 가까운 객체의 zIndex를 자동으로 높임 */}
            {/** style속성을 통해 선택이 안되게끔 함 */}
            <Html position={[0, 0, -1.2]} center zIndexRange={[100, 0]} style={{pointerEvents : 'none',}}>
              {/* <div ref={labelRef} className={`holo-label-container ${clicked.current === lName && control.current.mode === 1 ? 'active' : ''}`}> */}
              <div ref={labelRef} className={`holo-label-container ${hover.current != 0 ? 'active' : ''}`}>
                    <span className="lName-label">{lName}</span>
              </div>
            </Html>
        </group>
    </group>
  );
}
