export const Sk = ({ w = '100%', h = 14, r }) => <span className="sk" style={{ width: w, height: h, borderRadius: r }} />

export function TableSkeleton({ rows = 10, cols = 7 }) {
  return <div className="tablewrap"><table><thead><tr>{Array.from({ length: cols }).map((_, i) => <th key={i}><Sk w={70} h={12} /></th>)}</tr></thead>
    <tbody>{Array.from({ length: rows }).map((_, r) => <tr key={r}>{Array.from({ length: cols }).map((_, c) => <td key={c}><Sk w={c === 1 ? 160 : 60} h={12} /></td>)}</tr>)}</tbody></table></div>
}
export function CardsSkeleton({ n = 4 }) {
  return Array.from({ length: n }).map((_, i) => <div key={i} className="mcard"><Sk w={120} h={12} /><div style={{ height: 10 }} /><Sk w="80%" h={14} /><div style={{ height: 14 }} />
    <div className="mstats"><Sk h={34} /><Sk h={34} /><Sk h={34} /></div></div>)
}
export function DashSkeleton() {
  return <>
    <Sk w={200} h={26} />
    <div className="card" style={{ marginTop: 16 }}><Sk w={80} h={22} />
      <div className="kpis" style={{ marginTop: 16 }}>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card kpi"><Sk w={70} h={10} /><div style={{ height: 12 }} /><Sk w={100} h={30} /></div>)}</div>
      <div className="grid2">{[0, 1].map(i => <div key={i} className="card">{Array.from({ length: 5 }).map((_, j) => <div key={j} style={{ margin: '14px 0' }}><Sk h={14} /></div>)}</div>)}</div></div>
  </>
}
export default function PageSkeleton({ page }) {
  if (page === 'dashboard') return <DashSkeleton />
  if (page === 'upload') return <><Sk w={160} h={26} />{[0, 1].map(i => <div key={i} className="card" style={{ marginTop: 16 }}><Sk w={200} h={18} /><div style={{ height: 12 }} /><Sk h={12} /><div style={{ height: 8 }} /><Sk w="70%" h={12} /></div>)}</>
  return <><Sk w={240} h={26} /><div style={{ height: 16 }} /><div className="hide-m"><TableSkeleton /></div><div className="show-m"><CardsSkeleton /></div></>
}
