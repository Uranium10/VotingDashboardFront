import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import SouthKorea from "@svg-maps/south-korea";
import KoreaSVGMap from "./KoreaSVGMap";
import { RegionNameMap, RegionLabel } from "./constants";
export default function KoreaMap({ onRegionClick, control, round }) {
  const sMod = useRef(0);
  const scale = 0.04;
  const clicked = useRef("");
  const childs = useRef({});

  function registerChild(name, func){
    // 지역 : 클릭 이벤트 형태로 딕트 저장
    childs.current[name] = func;
    console.log([name, func]);
  }
  useEffect(()=>{
    function keyDown(e){
      if (clicked == "") return;
      if (control.current.mode != 1) return;
      if (e.keyCode == 37 || e.keyCode == 39){
        let idx = RegionLabel.indexOf(clicked.current);
        if (e.keyCode == 37)
          idx = (idx + RegionLabel.length-1) % RegionLabel.length;
        if (e.keyCode == 39)
          idx = (idx+1) % RegionLabel.length;
        let nextRegion = RegionLabel[idx];
        childs.current[nextRegion]();
      }
    }
    window.addEventListener("keydown", keyDown);
    return ()=> {
      window.removeEventListener("keydown", keyDown);
    };
  }, []);
  useFrame(()=>{
    if (control.current.offFocus){
      control.current.offFocus = false;
      clicked.current = "";
    }
  })
  return (
      // SVG 좌표계와 WebGL좌표계의 Y값은 반대. rotation을 통해 뒤집어줘야 한다.
      <group scale={[scale, scale, 1]} rotation={[Math.PI, 0, 0]}>
      {SouthKorea.locations.map((location,index) => {
        return (
        <KoreaSVGMap location={location} 
        lName={RegionNameMap[location.name] || location.name} 
        onRegionClick={onRegionClick}
        key={`${location.name}SVG`}
        clicked={clicked}
        control={control}
        reg={registerChild}
        round={round}
        />
        );
      })}
      </group>
  );
}
