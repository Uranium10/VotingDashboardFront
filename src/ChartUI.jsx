import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell, LabelList
} from 'recharts';
import './ChartUI.css';

// 💡 안전한 서버 주소 하드코딩
const API = window.location.protocol + "//" + window.location.hostname + ":8000";

function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!url) { setData(null); setLoading(false); setError(null); return; }
    let cancelled = false;
    const TIMEOUT_MS = isFirstLoad.current ? 30000 : 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    setLoading(true); setError(null);
    fetch(url, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`서버 오류 (HTTP ${r.status})`); return r.json(); })
      .then(d => { if (!cancelled) { setData(d); setLoading(false); isFirstLoad.current = false; } })
      .catch(e => { if (!cancelled) { setError(e.name === 'AbortError' ? `응답 지연 — 백엔드가 켜져있는지 확인하세요.` : e.message); setLoading(false); } })
      .finally(() => clearTimeout(timer));

    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [url]);

  return { data, loading, error };
}

const Loading = () => <div className="cu-loading"><div className="cu-spinner" /><span>데이터를 불러오는 중입니다...</span></div>;
const Err = ({ msg }) => <div className="cu-error">⚠ 통신 오류 — {msg}</div>;
const SectionHeader = ({ title }) => <div className="cu-section-header"><div className="cu-dot" /><h3>{title}</h3></div>;

function DonutChart({ values, colors, size = 110, thickness = 18 }) {
  const r = (size / 2) - thickness / 2;
  const circ = 2 * Math.PI * r;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
      {values.map((v, i) => {
        const dash = (v / total) * circ;
        const slice = <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={colors[i]} strokeWidth={thickness} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} style={{ transition: 'stroke-dasharray 0.8s ease' }} />;
        offset += dash;
        return slice;
      })}
    </svg>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a2840', border: '1px solid rgba(83,143,255,0.2)', borderRadius: 6, padding: '8px 12px', fontSize: '0.72rem', color: '#e8edf5' }}>
      <div style={{ marginBottom: 4, color: 'white' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span>{p.name}: </span><span style={{ fontWeight: 500 }}>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}%</span>
        </div>
      ))}
    </div>
  );
};

function CompetitionSection({ region, round }) {
  const url = (region && ['7회', '8회', '9회'].includes(round)) ? `${API}/api/local/competition?region=${encodeURIComponent(region)}&round=${encodeURIComponent(round)}` : null;
  const { data, loading, error } = useFetch(url);

  if (!url) return <div className="cu-competition" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '24px 16px' }}>회차를 선택하면 경합 데이터를 볼 수 있습니다.</div>;
  if (loading) return <div className="cu-competition"><Loading /></div>;
  if (error) return <div className="cu-competition"><Err msg={error} /></div>;
  if (!data) return null;
  const maxRate = Math.max(...data.candidates.map(c => c.rate), 50);

  return (
    <div className="cu-competition cu-animate">
      <div className="cu-comp-header">
        <span className="cu-region-name">{region}</span>
        <span className={`cu-badge ${data.competition=="압승 예상"? "압승예상" : data.competition}`}>{data.competition}</span>
      </div>
      <div className="cu-poll-meta">{data.is_prediction ? `📊 여론조사 예측 (최신 ${data.poll_date || ''})` : `🗳 실제 선거 결과 · ${round}`}</div>
      
      { data.candidates.length > 0 ?
      <div className="cu-cand-row">
        {data.candidates.map((c) => (
          <div key={c.name} className="cu-cand-item">
            <div className="cu-cand-meta">
              <div>
                <span className="cu-cand-name" style={{ color: c.color }}>{c.name}</span><span className="cu-cand-party">{c.party}</span>
                {c.is_winner && <span className="cu-cand-winner-tag">{data.is_prediction ? '예측 당선' : '당선'}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="cu-cand-rate" style={{ color: c.color }}>{c.rate.toFixed(1)}%</span>
                {c.win_prob != null && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>확률 {c.win_prob}%</span>}
              </div>
            </div>
            <div className="cu-gauge-track">
              <div className={`cu-gauge-fill${c.is_winner ? ' winner-glow' : ''}`} style={{ width: `${(c.rate / maxRate) * 100}%`, background: c.color }} />
            </div>
          </div>
        ))}
      </div> :
      <div style={{textAlign: 'center', padding: '20px', color:'var(--text-muted)'}}>
        해당 회차의 데이터는 존재하지 않습니다.
      </div>
      }
      <div className="cu-gap-display">1위 - 2위 격차: <span>{data.gap.toFixed(1)}%p</span></div>
    </div>
  );
}

function SupportSection({ region, round, setSupportTab, supportTab }) {

  const url = (region && ['7회', '8회', '9회'].includes(round)) ? `${API}/api/local/support?region=${encodeURIComponent(region)}&round=${encodeURIComponent(round)}` : null;
  const { data, loading, error } = useFetch(url);

  if (!url) return <div className="cu-animate"><SectionHeader title="지지율 분석" /><div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 16px' }}>회차를 선택하세요.</div></div>;

  const topIdx = data?.total ? data.total.indexOf(Math.max(...data.total)) : 0;
  const topParty = data ? (data.parties[topIdx] === '보수정당' ? (data.party_labels?.['보수정당'] ?? '보수정당') : data.parties[topIdx]) : '';
  const topColor = data ? data.colors[topIdx] : '';
  const topRate = data ? data.total[topIdx] : 0;

  // 💡 [수정] 탭은 항상 3개를 모두 보여줍니다.
  const tabMenus = [ 
    { key: 'total', label: '전체' },
    { key: 'gender', label: '성별' }, 
    { key: 'age', label: '연령별' } 
  ];

  // 안내문구 컴포넌트
  const EmptyState = () => (
    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
      🗳️ 과거 선거(7·8회)는 비밀투표 원칙에 따라<br/>성별 및 연령별 실제 개표 데이터를 제공하지 않습니다.
    </div>
  );

  return (
    <div className="cu-animate">
      <SectionHeader title="지지율 분석" />
      <div className="cu-support">
        {loading && <Loading />}{error && <Err msg={error} />}
        {data && (
          <>
            <div className="cu-tab-row">
              {tabMenus.map(t => (
                <button key={t.key} className={`cu-tab-btn${supportTab === t.key ? ' active' : ''}`} onClick={() => setSupportTab(t.key)}>{t.label}</button>
              ))}
            </div>
            
            {supportTab === 'total' && (
              <div className="cu-support-body">
                <div className="cu-donut-wrap">
                  <DonutChart values={data.total} colors={data.colors} size={200} thickness={26} />
                  <div className="cu-donut-center">
                    <span className="cu-dc-val" style={{ color: topColor }}>{topRate.toFixed(1)}%</span>
                    <span className="cu-dc-label">{topParty.replace('더불어민주당', '민주당').replace('자유한국당', '한국당')}</span>
                  </div>
                </div>
                <div className="cu-legend">
                  {data.parties.map((p, i) => (
                    <div key={p} className="cu-legend-item">
                      <div className="cu-legend-dot" style={{ background: data.colors[i] }} />
                      <div className="cu-legend-info"><div className="cu-legend-name">{p === '보수정당' ? (data.party_labels?.['보수정당'] ?? p) : p}</div></div>
                      <span className="cu-legend-val" style={{ color: data.colors[i] }}>{data.total[i].toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 💡 [수정] 9회차면 차트를 보여주고, 아니면 EmptyState 안내문을 띄웁니다 */}
            {supportTab === 'gender' && (
              round === '9회' ? (
                <div className="cu-bar-group">
                  {data.by_gender.map(g => (
                    <div key={g.gender} className="cu-bar-row">
                      <span className="cu-bar-label">{g.gender}</span>
                      <div className="cu-bar-stack">
                        {data.parties.map((p, i) => <div key={p} className="cu-bar-seg" style={{ width: `${g.values[i]}%`, background: data.colors[i], opacity: i === 2 ? 0.6 : 1 }} />)}
                      </div>
                      <span className="cu-bar-pct">{g.values[0].toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState />
            )}

            {/* 💡 [수정] 9회차면 차트를 보여주고, 아니면 EmptyState 안내문을 띄웁니다 */}
            {supportTab === 'age' && (
              round === '9회' ? (
                <div className="cu-bar-group">
                  {data.by_age.map(a => (
                    <div key={a.age} className="cu-bar-row">
                      <span className="cu-bar-label" style={{ fontSize: '0.58rem' }}>{a.age.replace('대 이하', '대↓').replace('대 이상', '대↑')}</span>
                      <div className="cu-bar-stack">
                        {data.parties.map((p, i) => <div key={p} className="cu-bar-seg" style={{ width: `${a.values[i]}%`, background: data.colors[i], opacity: i === 2 ? 0.6 : 1 }} />)}
                      </div>
                      <span className="cu-bar-pct">{a.values[0].toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  3. 여론조사 추이 (9회 전용 — Recharts LineChart)
// ══════════════════════════════════════════════════════════
function PollTrendSection({ region, round }) {
  if (round !== '9회' || !region) return null;
  const url = `${API}/api/local/poll-trend?region=${encodeURIComponent(region)}`;
  const { data, loading, error } = useFetch(url);

  if (loading) return <div className="cu-animate"><div className="cu-divider" /><SectionHeader title="후보 여론조사 추이 (2026)" /><Loading /></div>;
  if (error) return <div className="cu-animate"><div className="cu-divider" /><SectionHeader title="후보 여론조사 추이 (2026)" /><Err msg={error} /></div>;
  if (!data?.candidates?.length) return null;

  const dateSet = new Set();
  data.candidates.forEach(c => c.trend.forEach(d => dateSet.add(d.date)));
  const merged = [...dateSet].sort().map(date => {
    const row = { date: date };
    data.candidates.forEach(c => row[c.name] = c.trend.find(d => d.date === date)?.mean ?? null);
    return row;
  });

  return (
    <div className="cu-animate">
      <div className="cu-divider" />
      <SectionHeader title="후보 여론조사 추이 (2026)" />
      {/* 💡 overflow: hidden 과 minWidth를 주어 찌그러지지 않고 부드럽게 가려지도록 설정 */}
      <div style={{ overflow: 'hidden', minWidth: '800px', height: '540px', padding: '0 8px 8px' }}>
        <LineChart width={'800px'} height={'540px'} data={merged} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" minTickGap={20} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => `${v}%`} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.65rem', color: 'var(--text-sub)' }} iconType="circle" iconSize={6} />
          {data.candidates.map(cand => (
            <Line key={cand.name} dataKey={cand.name} name={cand.name} stroke={cand.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
          ))}
        </LineChart>
      </div>
    </div>
  );
}
function AbstentionAgeSection() {
  const { data, loading, error } = useFetch(`${API}/api/local/abstention-age`);
  const [tab, setTab] = useState('intent');

  if (loading) return <Loading />; if (error) return <Err msg={error} />; if (!data?.data?.length) return null;
  const rows = data.data;

  return (
    <div className="cu-animate">
      <div className="cu-divider" /><SectionHeader title="연령대별 이탈 지표 (9회 예측)" />
      <div className="cu-abstention" style={{ padding: '0 16px 12px' }}>
        <div className="cu-tab-row" style={{ marginBottom: 10 }}>
          <button className={`cu-tab-btn${tab === 'intent' ? ' active' : ''}`} onClick={() => setTab('intent')}>기권의향</button>
          <button className={`cu-tab-btn${tab === 'attitude' ? ' active' : ''}`} onClick={() => setTab('attitude')}>의식지표</button>
        </div>
        {tab === 'intent' && (
          <div className="cu-bar-group">
            {rows.map(r => (
              <div key={r.age} className="cu-bar-row">
                <span className="cu-bar-label" style={{ fontSize: '0.6rem' }}>{r.age}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="cu-bar-stack" style={{ flex: 1, height: 9 }}><div className="cu-bar-seg" style={{ width: `${(r.abstention_rate / 100) * 100}%`, background: '#e74c3c' }} /></div><span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: 30 }}>{r.abstention_rate?.toFixed(1)}%</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="cu-bar-stack" style={{ flex: 1, height: 9 }}><div className="cu-bar-seg" style={{ width: `${(r.apathy_rate / 100) * 100}%`, background: '#888' }} /></div><span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: 30 }}>{r.apathy_rate?.toFixed(1)}%</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'attitude' && (
          <div className="cu-bar-group">
            {rows.map(r => (
              <div key={r.age} className="cu-bar-row" style={{ alignItems: 'flex-start' }}>
                <span className="cu-bar-label" style={{ fontSize: '0.6rem', paddingTop: 2 }}>{r.age}</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {[['#3498db', r.efficacy], ['#2ecc71', r.policy_awareness], ['#f39c12', r.fair_election]].map(([color, val], idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="cu-bar-stack" style={{ flex: 1, height: 8 }}><div className="cu-bar-seg" style={{ width: `${((val || 0) / 100) * 100}%`, background: color }} /></div><span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: 30 }}>{val?.toFixed(1) ?? '-'}</span></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* 💡 [수정] 탭별 맞춤형 범례(Legend) 추가 */}
        {tab === 'intent' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '8px', fontSize: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#e74c3c', borderRadius: '2px' }} />기권 의향률</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#888', borderRadius: '2px' }} />정치 무관심률</div>
          </div>
        )}
        {tab === 'attitude' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '8px', fontSize: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#3498db', borderRadius: '2px' }} />정치 효능감</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#2ecc71', borderRadius: '2px' }} />정책 인지도</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#f39c12', borderRadius: '2px' }} />공정 선거 인식</div>
          </div>
        )}
      </div>
    </div>
  );
}
function PredictionSection({ round }) {
  if (round !== '9회') return null;
  const { data, loading, error } = useFetch(`${API}/api/global/prediction?round=9회`);
  const [view, setView] = useState('prob');

  return (
    <div className="cu-animate">
      <SectionHeader title="9회 전국 당선 예측" />
      <div className="cu-global-tabs" style={{ paddingTop: 0, paddingBottom: 8 }}>
        <button className={`cu-global-tab${view === 'prob' ? ' active' : ''}`} onClick={() => setView('prob')}>당선 확률</button>
        <button className={`cu-global-tab${view === 'gap' ? ' active' : ''}`} onClick={() => setView('gap')}>경합도</button>
      </div>
      {loading && <Loading />}{error && <Err msg={error} />}
      {data?.regions && (
        <>
          {view === 'prob' && (
            <div className="cu-pred-list">
              {[...data.regions].sort((a, b) => b.win_prob - a.win_prob).map(r => (
                <div key={r.region} className="cu-pred-row">
                  {/* 💡 [수정] replace 삭제: constants.js와 동일한 풀네임 노출 */}
                  <span className="cu-pred-region">{r.region}</span>
                  <div className="cu-pred-bar-wrap"><div className="cu-pred-bar-fill" style={{ width: `${r.win_prob}%`, background: r.winner_color }} /></div>
                  <span className="cu-pred-winner">{r.winner_name}</span><span className="cu-pred-prob">{r.win_prob}%</span>
                </div>
              ))}
            </div>
          )}
          {view === 'gap' && (
            <div className="cu-gap-list">
              {[...data.regions].sort((a, b) => a.gap - b.gap).map(r => (
                <div key={r.region} className="cu-gap-row">
                  {/* 💡 [수정] replace 삭제: constants.js와 동일한 풀네임 노출 */}
                  <span className="cu-gap-region">{r.region}</span>
                  <div className="cu-gap-bar-wrap"><div className="cu-gap-bar-fill" style={{ width: `${Math.min((r.gap / 40) * 100, 100)}%`, background: r.competition_color }} /></div>
                  {/* 💡 [수정] 백엔드에서 넘겨준 경합도 배지(badge) 텍스트 노출 */}
                  <span style={{ fontSize: '0.65rem', color: r.competition_color, fontWeight: 'bold', width: '45px', textAlign: 'center' }}>{r.badge}</span>
                  <span className="cu-gap-val" style={{ color: r.competition_color }}>{r.gap.toFixed(1)}%p</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PartyTrendSection() {
  const { data, loading, error } = useFetch(`${API}/api/global/party-trend`);
  if (loading) return <div className="cu-animate"><SectionHeader title="전국 정당 지지율 추이" /><Loading /></div>;
  if (error) return <div className="cu-animate"><SectionHeader title="전국 정당 지지율 추이" /><Err msg={error} /></div>;
  if (!data?.parties?.length) return null;

  const dateSet = new Set();
  data.parties.forEach(p => p.data.forEach(d => dateSet.add(d.date)));
  const merged = [...dateSet].sort().map(date => {
    // 💡 [수정] 여기서 slice(5)를 하지 않고 원본 날짜 유지 (XAxis에서 한 번만 자름)
    const row = { date: date }; 
    data.parties.forEach(p => row[p.name] = p.data.find(d => d.date === date)?.mean ?? null);
    return row;
  });

  return (
    <div className="cu-animate">
      <div className="cu-divider" /><SectionHeader title="전국 정당 지지율 추이" />
      <div style={{ padding: '0 8px 8px', width: '800px'}}>
        <div style={{ overflow: 'hidden', minWidth: '800px', height: '540px', padding: '0 8px 8px' }}>
          <LineChart data={merged} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            {/* 💡 [수정] interval="preserveStartEnd" 로 변경하여 날짜가 겹치거나 에러가 나는 현상 차단 */}
            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" minTickGap={20} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => `${v}%`} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.65rem' }} iconType="circle" iconSize={6} />
            {data.parties.map(p => <Line isAnimationActive={false} key={p.name} dataKey={p.name} stroke={p.color} strokeWidth={2} dot={false} connectNulls />)}
          </LineChart>
        </div>
      </div>
    </div>
  );
}
function WinsByPartySection({ round }) {
  const { data, loading, error } = useFetch(`${API}/api/global/wins-by-party`);
  if (loading) return <Loading />; if (error) return <Err msg={error} />; if (!data?.parties?.length) return null;

  const chartData = data.parties.map(p => ({ party: p.party, '7회': p.wins[0], '8회': p.wins[1], color: p.color }));

  return (
    <div className="cu-animate">
      <div className="cu-divider" /><SectionHeader title="7·8회 정당별 당선 수 비교" />
      <div style={{ overflow: 'hidden', minWidth: '800px', padding: '0 16px 8px' }}>
        <BarChart width={800} height={140} data={chartData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="party" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} formatter={(v) => [v, '석']} />
          <Legend wrapperStyle={{ fontSize: '0.65rem' }} />
          <Bar dataKey="7회" fill="#538fff" opacity={0.55} radius={[3, 3, 0, 0]}><LabelList dataKey="7회" position="top" style={{ fontSize: 9, fill: 'var(--text-muted)' }} /></Bar>
          <Bar dataKey="8회" radius={[3, 3, 0, 0]}>{chartData.map((d, i) => <Cell key={i} fill={d.color} />)}<LabelList dataKey="8회" position="top" style={{ fontSize: 9, fill: 'var(--text-primary)' }} /></Bar>
        </BarChart>
      </div>
    </div>
  );
}
// =====================================================================
// 1. [신규] 로컬 패널: 투표율/기권율 요약 카드 (전회차 비교 포함)
// =====================================================================
function LocalTurnoutSection({ region, round }) {
  const url = (region && round) ? `${API}/api/local/turnout?region=${encodeURIComponent(region)}&round=${encodeURIComponent(round)}` : null;
  const { data, loading, error } = useFetch(url);

  if (!url) return null;
  if (loading) return <div className="cu-animate"><div className="cu-divider" /><SectionHeader title={`${round} 투표/이탈(기권) 요약`} /><Loading /></div>;
  if (error) return <div className="cu-animate"><div className="cu-divider" /><SectionHeader title={`${round} 투표/이탈(기권) 요약`} /><Err msg={error} /></div>;
  if (!data?.current) return null;

  const { current, diff } = data;

  return (
    <div className="cu-animate">
      {/* 주제 강조를 위해 경쟁률 게이지 바로 아래에 디바이더 없이 배치합니다 */}
      <div style={{ padding: '0 16px 16px'}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '16px 20px', borderRadius: '8px', overflow: 'hidden', position:'relative'  }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-sub)', marginBottom: '4px' }}>{round} 전체 투표율</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3498db', fontFamily: 'var(--font-num)' }}>{current.turnout.toFixed(1)}%</div>
            </div>
          </div>
          {/* toFixed는 소수점 아래 자르기. */}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-sub)', marginBottom: '4px' }}>{round} 기권율 (이탈률)</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '8px' }}>
              {diff != null && (
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-num)', color: diff > 0 ? '#e74c3c' : '#27ae60' }}>
                  {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}%p
                </span>
              )}
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e74c3c', fontFamily: 'var(--font-num)' }}>{current.abstention.toFixed(1)}%</div>
            </div>
            {/* 7회차는 비교 대상이 없으므로 안내문구를 생략합니다 */}
            {diff != null && <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px' }}>전회차 대비 증감</div>}
          </div>
          <div className='cu-turnoutSectionGauge'>
              <div style={{height:'100%', flexGrow: `${current.turnout}`, backgroundColor: '#3498db'}}></div>
              {diff != null && <div style={{height:'100%', flexGrow: `${Math.abs(diff)}`, backgroundColor: `${diff > 0 ? "#747474" : "#27ae60"}`}}></div>}
              <div style={{height:'100%', flexGrow: `${100 - current.turnout - (Math.abs(diff) ?? 0)}`, backgroundColor: '#e74c3c'}}></div>

          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 2. [신규] 글로벌 패널: 기권율 듀얼 탭 (a. 시도별 비교 & b. 전체 라인 차트)
// =====================================================================
function GlobalTurnoutDualSection({ round }) {
  const [tab, setTab] = useState('compare');
  
  const url = tab === 'compare' 
    ? `${API}/api/global/abstention-sido-compare?round=${encodeURIComponent(round)}`
    : `${API}/api/global/turnout-trend`;
    
  const { data, loading, error } = useFetch(url);

  return (
    <div className="cu-animate">
      <div className="cu-divider" />
      <SectionHeader title="기권율 및 투표율 상세 분석" />
      
      <div style={{ padding: '0 16px 12px' }}>
        <div className="cu-tab-row" style={{ marginBottom: 16 }}>
          <button className={`cu-tab-btn${tab === 'compare' ? ' active' : ''}`} onClick={() => setTab('compare')}>
            {round === '7회' ? '7회 시도별 기권율' : '전회차 대비 기권 증감 추이'}
          </button>
          <button className={`cu-tab-btn${tab === 'trend' ? ' active' : ''}`} onClick={() => setTab('trend')}>
            연령대별 기권율 추이
          </button>
        </div>
        
        {loading && <Loading />}
        {error && <Err msg={error} />}
        
        {/* TAB A: Compare (전회차 대비 증감) */}
        {tab === 'compare' && data?.regions && (
          <div style={{ overflow: 'hidden', minWidth: '800px', height: '340px' }}>
            <BarChart data={data.regions} width={800} height={340} layout="vertical" margin={{ top: 4, right: 40, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" domain={[30, 70]} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-sub)', fontSize: 9 }} width={75} />
              <Tooltip content={<ChartTooltip />} formatter={(v) => [`${v}%`]} />
              <Legend wrapperStyle={{ fontSize: '0.65rem' }} />
              
              {round !== '7회' && (
                <Bar isAnimationActive={false} dataKey="prev" name="전회차 기권율" fill="#5b9bd5" radius={[0, 3, 3, 0]} barSize={6}>
                  <LabelList dataKey="diff" position="right" formatter={v => v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)} style={{ fontSize: 8 }} fill="var(--text-primary)" />
                </Bar>
              )}
              
              <Bar isAnimationActive={false} dataKey="current" name={`${round} 기권율`} radius={[0, 3, 3, 0]} barSize={round === '7회' ? 10 : 6}>
                {data.regions.map((d, i) => <Cell key={i} fill={d.diff_color || "#e74c3c"} />)}
              </Bar>
            </BarChart>
          </div>
        )}
        
        {/* 💡 TAB B: Trend (연령대별 다중 라인 차트) */}
        {tab === 'trend' && (
          data?.trend?.length > 0 && data?.age_groups?.length > 0 ? (
            <div style={{ overflow: 'hidden', minWidth: '800px', height: '340px' }}>
              <LineChart width={800} height={340} data={data.trend} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="round" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                
                {/* Y축을 0~100 고정 */}
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.65rem' }} />
                
                {data.age_groups.map(ag => (
                  <Line 
                    key={ag.age}
                    isAnimationActive={false} 
                    type="monotone" 
                    dataKey={ag.age} 
                    name={`${ag.age} 기권율`} 
                    stroke={ag.color} 
                    strokeWidth={2} 
                    dot={{ r: 4 }} 
                    activeDot={{ r: 6 }} 
                    connectNulls={true} 
                  />
                ))}
              </LineChart>
            </div>
          ) : !loading && (
            // 💡 데이터 구조가 안 맞으면 빈 화면 대신 명확한 원인 출력
            <div style={{ padding: '30px', margin: '20px', textAlign: 'center', background: 'rgba(231,76,60,0.1)', border: '1px solid #e74c3c', borderRadius: '8px', color: '#e74c3c', fontSize: '0.8rem' }}>
              🚨 차트 데이터가 비어 있습니다.<br/>
              백엔드에서 데이터를 추출하지 못했습니다. CSV 파일의 데이터가 정상인지 확인해 주세요.
            </div>
          )
        )}
      </div>
    </div>
  );
}

// =====================================================================
// 3. [신규] 글로벌 패널: 해당 회차 연령별 투표율/기권율
// =====================================================================
function GlobalTurnoutAgeSection({ round }) {
  const { data, loading, error } = useFetch(`${API}/api/global/turnout-age?round=${encodeURIComponent(round)}`);

  if (loading) return <div className="cu-animate"><div className="cu-divider" /><SectionHeader title={`${round} 전국 연령별 투표율`} /><Loading /></div>;
  if (error) return <div className="cu-animate"><div className="cu-divider" /><SectionHeader title={`${round} 전국 연령별 투표율`} /><Err msg={error} /></div>;
  if (!data?.data?.length) return null;

  return (
    <div className="cu-animate">
      <div className="cu-divider" />
      <SectionHeader title={`${round} 전국 연령별 투표율 및 기권율`} />
      <div style={{ overflow: 'hidden', minWidth: '800px', height: '180px', padding: '0 8px 8px' }}>
        <BarChart width={800} height={180} data={data.data} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="age" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.65rem' }} />
          <Bar isAnimationActive={false} dataKey="abstention" name="기권율" fill="#e74c3c" opacity={0.8} barSize={16} radius={[3, 3, 0, 0]} />
          <Bar isAnimationActive={false} dataKey="turnout" name="투표율" fill="#3498db" barSize={16} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="turnout" position="top" formatter={v => `${v.toFixed(1)}%`} style={{ fill: 'var(--text-primary)', fontSize: 9 }} />
          </Bar>
        </BarChart>
      </div>
    </div>
  );
}
function HouseEffectSection() {
  const { data, loading, error } = useFetch(`${API}/api/global/house-effect`);
  if (loading) return <Loading />; if (error) return <Err msg={error} />; if (!data?.parties?.length) return null;

  const chartData = data.agencies.map(ag => {
    const row = { agency: ag };
    data.parties.forEach(p => { const found = p.by_agency.find(b => b.agency === ag); if (found) { row[`${p.name}_median`] = found.median; row[`${p.name}_color`] = p.color; } });
    return row;
  });

  return (
    <div className="cu-animate">
      <div className="cu-divider" /><SectionHeader title="여론조사 기관별 편향성 (하우스 이펙트)" />
      <div className="cu-house" width="800px">
        <div style={{ overflow: 'hidden', minWidth: '800px', padding: '0 16px 8px' }}>
          <BarChart data={chartData} width={800} height={160} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="agency" tick={{ fill: 'var(--text-muted)', fontSize: 8 }} />
            <YAxis domain={[15, 60]} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => `${v}%`} />
            <Tooltip content={<ChartTooltip />} formatter={v => [`${v}%`]} />
            <Legend wrapperStyle={{ fontSize: '0.65rem' }} />
            {data.parties.map(p => <Bar key={p.name} dataKey={`${p.name}_median`} name={p.name} fill={p.color} radius={[3, 3, 0, 0]} opacity={0.85} />)}
          </BarChart>
        </div>
      </div>
    </div>
  );
}

function LocalPanel({ loc, round }) {
  const [supportTab, setSupportTab] = useState('total');
  
  // 💡 [수정] 지역이나 회차가 바뀌면 무조건 'total(전체)' 탭으로 돌아오도록 수정
  useEffect(() => setSupportTab('total'), [round]); 

  return (
    <div className="cu-inner">
      <CompetitionSection region={loc} round={round} />
      <LocalTurnoutSection region={loc} round={round} />
      <div className="cu-divider" />
      <SupportSection region={loc} round={round} setSupportTab={setSupportTab} supportTab={supportTab} />
      <PollTrendSection region={loc} round={round} />
    </div>
  );
}

function GlobalPanel({ round }) {
  return (
    <div className="cu-inner">
      <PredictionSection round={round} />
      <PartyTrendSection />
      { round != "9회" &&
      <WinsByPartySection round={round} />
      }
      {/* 💡 2번 요구사항: 기존 하드코딩 삭제하고 듀얼 탭 컴포넌트로 대체 */}
      <GlobalTurnoutDualSection round={round} />
      
      {/* 💡 3번 요구사항: 연령대별 이탈 지표(의식지표) 바로 위에 투표율/기권율 차트 배치 */}
      <GlobalTurnoutAgeSection round={round} />
      { round === "9회" && <AbstentionAgeSection /> }
      
      <HouseEffectSection />
    </div>
  );
}

export default function ChartUI({ backBut, control, loc, round }) {
  const isActive = backBut === 1;
  return (
    <div className={`chart-container${isActive ? ' active' : ''}`}>
      <div className="chart-ui">
        <div className="chart-panel chart-local">
          <div className="chart-title">{loc && <span>{loc}</span>}<span>{`${round} 지방선거${round === '9회' ? ' (예측)' : ''}`}</span></div>
          {loc ? <LocalPanel loc={loc} round={round} /> : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}><span style={{ fontSize: '1.8rem' }}>🗺</span><span>지도에서 지역을 클릭하세요</span></div>}
        </div>
        <div className="chart-panel chart-global">
          <div className="chart-title" style={{ backgroundColor: '#1a2840', borderBottom: '1px solid rgba(83,143,255,0.15)' }}>
            <span>전국 데이터</span>
          </div>
          <GlobalPanel round={round} />
        </div>
      </div>
    </div>
  );
}