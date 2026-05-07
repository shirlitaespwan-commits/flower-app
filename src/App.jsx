import { useState, useEffect } from "react"
import * as XLSX from "xlsx"
import { db } from "./firebase"
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, setDoc
} from "firebase/firestore"

const PRODUCTS = [
  '小花醬','大花醬','小花茶','大花茶','花瓣','花瓣粉',
  '牛奶棒','純露','玫瑰蜂蜜','鮮花一公斤','鮮花100g',
  '花醬一公斤','糖多花醬一公斤','其他'
]

const SUPPLIES = [
  '大花醬罐子','小花茶罐子','大花茶罐子','花瓣罐子','花瓣粉罐子','小禮盒包裝'
]

const today = () => new Date().toISOString().slice(0,10)

const labelStyle = { display: 'block', fontSize: 12, color: '#888', marginBottom: 4, marginTop: 14 }
const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }
const btnStyle = { width: '100%', padding: 10, background: '#534AB7', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 16 }
const editBtnStyle = { padding: '5px 10px', fontSize: 12, background: 'transparent', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', color: '#666' }
const sectionTitle = { fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }

export default function App() {
  const [tab, setTab] = useState('shipment')
  const [date, setDate] = useState(today())
  const [customer, setCustomer] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [selected, setSelected] = useState({})
  const [otherDesc, setOtherDesc] = useState('')
  const [shipments, setShipments] = useState([])
  const [supplies, setSupplies] = useState(
    SUPPLIES.map(name => ({ name, qty: 0, date: today() }))
  )
  const [expenses, setExpenses] = useState([])
  const [recorder, setRecorder] = useState('小淇')
  const [expDate, setExpDate] = useState(today())
  const [expType, setExpType] = useState('運費')
  const [expAmount, setExpAmount] = useState('')
  const [expNote, setExpNote] = useState('')

  // 即時同步出貨記錄
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shipments'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => b.createdAt - a.createdAt)
      setShipments(data)
    })
    return unsub
  }, [])

  // 即時同步支出記錄
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'expenses'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => b.createdAt - a.createdAt)
      setExpenses(data)
    })
    return unsub
  }, [])

  // 即時同步耗材
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'supplies'), snap => {
      if (snap.docs.length > 0) {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setSupplies(data)
      }
    })
    return unsub
  }, [])

  function toggleProduct(name) {
    setSelected(prev => {
      const next = Object.assign({}, prev)
      if (next[name]) delete next[name]
      else next[name] = 1
      return next
    })
  }

  function changeQty(name, delta) {
    setSelected(prev => {
      const next = Object.assign({}, prev)
      const newQty = (next[name] || 1) + delta
      if (newQty <= 0) delete next[name]
      else next[name] = newQty
      return next
    })
  }

  async function submitShipment() {
    if (!customer) { alert('請選擇客戶'); return }
    if (Object.keys(selected).length === 0) { alert('請選擇商品'); return }
    const record = {
      createdAt: Date.now(),
      date,
      customer: (customer === 'b2b' || customer === '面交') ? (customerName || customer) : customer,
      items: Object.keys(selected).map(name => ({ name, qty: selected[name] })),
      otherDesc
    }
    await addDoc(collection(db, 'shipments'), record)
    setSelected({})
    setCustomer('')
    setCustomerName('')
    setOtherDesc('')
    alert('出貨單已建立！')
  }

  async function deleteShipment(id) {
    if (!window.confirm('確定要刪除這筆出貨記錄？')) return
    await deleteDoc(doc(db, 'shipments', id))
  }

  async function deleteExpense(id) {
    if (!window.confirm('確定要刪除這筆支出記錄？')) return
    await deleteDoc(doc(db, 'expenses', id))
  }

  async function updateSupply(i, qty) {
    const s = supplies[i]
    const updated = { name: s.name, qty: Number(qty), date: today() }
    if (s.id) {
      await setDoc(doc(db, 'supplies', s.id), updated)
    } else {
      await addDoc(collection(db, 'supplies'), updated)
    }
  }

  async function submitExpense() {
    if (!expAmount) { alert('請輸入金額'); return }
    const record = {
      createdAt: Date.now(),
      recorder,
      date: expDate,
      type: expType,
      amount: expAmount,
      note: expNote
    }
    await addDoc(collection(db, 'expenses'), record)
    setExpAmount('')
    setExpNote('')
    alert('支出已記錄！')
  }

  function exportShipmentExcel() {
    if (shipments.length === 0) { alert('還沒有出貨記錄'); return }
    const rows = []
    shipments.forEach(s => {
      s.items.forEach(item => {
        rows.push({
          日期: s.date,
          客戶: s.customer,
          商品: item.name,
          數量: item.qty,
          其他說明: s.otherDesc || ''
        })
      })
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '出貨記錄')
    XLSX.writeFile(wb, '出貨記錄.xlsx')
  }

  function exportExpenseExcel() {
    if (expenses.length === 0) { alert('還沒有支出記錄'); return }
    const rows = expenses.map(e => ({
      日期: e.date,
      紀錄人: e.recorder,
      類別: e.type,
      金額: e.amount,
      備註: e.note || ''
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '支出記錄')
    XLSX.writeFile(wb, '支出記錄.xlsx')
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', fontFamily: 'sans-serif', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: '#3C3489', color: '#EEEDFE', padding: '14px 16px', fontSize: 16, fontWeight: 500 }}>
        🌸 花卉出貨管理
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
        {[['shipment','📦 出貨'],['stock','🗂️ 耗材'],['expense','💰 支出'],['records','📋 記錄']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '10px 4px', fontSize: 12, border: 'none', cursor: 'pointer',
            background: 'transparent', borderBottom: tab === id ? '2px solid #534AB7' : '2px solid transparent',
            color: tab === id ? '#534AB7' : '#888', fontWeight: tab === id ? 600 : 400
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {tab === 'shipment' && (
          <div>
            <label style={labelStyle}>出貨日期</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />

            <label style={labelStyle}>客戶</label>
            <select value={customer} onChange={e => { setCustomer(e.target.value); setCustomerName('') }} style={inputStyle}>
              <option value="">請選擇</option>
              <option value="賣貨便">賣貨便</option>
              <option value="全家">全家</option>
              <option value="郵局">郵局</option>
              <option value="雪莉自取">雪莉自取</option>
              <option value="面交">面交</option>
              <option value="b2b">B2B客戶</option>
            </select>

            {(customer === '面交' || customer === 'b2b') && (
              <div>
                <label style={labelStyle}>客戶名稱</label>
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="輸入客戶名稱" style={inputStyle} />
              </div>
            )}

            <label style={labelStyle}>選擇商品</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 4 }}>
              {PRODUCTS.map(p => (
                <div key={p} onClick={() => toggleProduct(p)} style={{
                  padding: '7px 4px', border: selected[p] ? '1.5px solid #534AB7' : '1px solid #ddd',
                  borderRadius: 8, fontSize: 12, textAlign: 'center', cursor: 'pointer',
                  background: selected[p] ? '#EEEDFE' : 'white',
                  color: selected[p] ? '#3C3489' : '#666',
                  fontWeight: selected[p] ? 600 : 400
                }}>{p}</div>
              ))}
            </div>

            {selected['其他'] && (
              <div>
                <label style={labelStyle}>其他商品說明</label>
                <input type="text" value={otherDesc} onChange={e => setOtherDesc(e.target.value)} placeholder="請描述商品內容" style={inputStyle} />
              </div>
            )}

            {Object.keys(selected).length > 0 && (
              <div style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                {Object.keys(selected).map(name => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => changeQty(name, -1)} style={{ width: 26, height: 26, border: '1px solid #ddd', borderRadius: '50%', background: 'transparent', fontSize: 16, cursor: 'pointer' }}>−</button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600, color: '#534AB7' }}>{selected[name]}</span>
                      <button onClick={() => changeQty(name, 1)} style={{ width: 26, height: 26, border: '1px solid #ddd', borderRadius: '50%', background: 'transparent', fontSize: 16, cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={submitShipment} style={btnStyle}>建立出貨單</button>
          </div>
        )}

        {tab === 'stock' && (
          <div>
            <div style={sectionTitle}>耗材庫存</div>
            {supplies.map((s, i) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>最後更新 {s.date}</div>
                </div>
                <input
                  type="number"
                  defaultValue={s.qty}
                  id={'supply_' + i}
                  style={{ width: 64, padding: '5px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}
                />
                <button onClick={() => {
                  const val = document.getElementById('supply_' + i).value
                  updateSupply(i, val)
                }} style={editBtnStyle}>更新</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'expense' && (
          <div>
            <label style={labelStyle}>紀錄人</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {['小淇','雪莉'].map(r => (
                <button key={r} onClick={() => setRecorder(r)} style={{
                  flex: 1, padding: 8, border: recorder === r ? '1.5px solid #534AB7' : '1px solid #ddd',
                  borderRadius: 8, background: recorder === r ? '#EEEDFE' : 'white',
                  color: recorder === r ? '#3C3489' : '#666',
                  fontWeight: recorder === r ? 600 : 400, cursor: 'pointer', fontSize: 14
                }}>{r}</button>
              ))}
            </div>

            <label style={labelStyle}>日期</label>
            <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} style={inputStyle} />

            <label style={labelStyle}>類別</label>
            <select value={expType} onChange={e => setExpType(e.target.value)} style={inputStyle}>
              <option>運費</option>
              <option>稅金</option>
              <option>包材</option>
              <option>其他</option>
            </select>

            <label style={labelStyle}>金額（元）</label>
            <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0" style={inputStyle} />

            <label style={labelStyle}>備註</label>
            <input type="text" value={expNote} onChange={e => setExpNote(e.target.value)} placeholder="選填" style={inputStyle} />

            <button onClick={submitExpense} style={btnStyle}>記錄支出</button>
          </div>
        )}

        {tab === 'records' && (
          <div>
            <button onClick={exportShipmentExcel} style={{...btnStyle, background: '#22a06b', marginTop: 0}}>
              📊 匯出出貨記錄 Excel
            </button>

            <div style={{...sectionTitle, marginTop: 16}}>出貨記錄</div>
            {shipments.length === 0 && (
              <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 20 }}>還沒有出貨記錄</div>
            )}
            {shipments.map(s => (
              <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.customer}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#999' }}>{s.date}</span>
                    <button onClick={() => deleteShipment(s.id)} style={{ padding: '2px 8px', fontSize: 11, background: 'transparent', border: '1px solid #ffb3b3', borderRadius: 6, color: '#e53e3e', cursor: 'pointer' }}>刪除</button>
                  </div>
                </div>
                <div>
                  {s.items.map(item => (
                    <span key={item.name} style={{ display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#EEEDFE', color: '#3C3489', marginRight: 4, marginTop: 3 }}>
                      {item.name} x{item.qty}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            <button onClick={exportExpenseExcel} style={{...btnStyle, background: '#22a06b', marginTop: 16}}>
              📊 匯出支出記錄 Excel
            </button>

            <div style={{...sectionTitle, marginTop: 16}}>支出記錄</div>
            {expenses.length === 0 && (
              <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: 20 }}>還沒有支出記錄</div>
            )}
            {expenses.map(e => (
              <div key={e.id} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{e.type} — NT${e.amount}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#999' }}>{e.date}</span>
                    <button onClick={() => deleteExpense(e.id)} style={{ padding: '2px 8px', fontSize: 11, background: 'transparent', border: '1px solid #ffb3b3', borderRadius: 6, color: '#e53e3e', cursor: 'pointer' }}>刪除</button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>記錄人：{e.recorder}{e.note ? `　${e.note}` : ''}</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}