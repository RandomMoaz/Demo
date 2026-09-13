import { useApp } from '../context/AppContext'
import { LANGS } from '../lib/data'
import { TabBar } from '../components/Chrome'

export default function Settings() {
  const { t, theme, setTheme, lang, go } = useApp()
  const Row = ({ label, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>{children}</span>
    </div>
  )
  const Pill = ({ on, onClick, children }) => (
    <button onClick={onClick} style={{
      border: '1px solid var(--line)', borderRadius: 20, padding: '8px 13px', minHeight: 38, cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 12.5, background: on ? 'var(--lapis-soft)' : 'var(--surface)',
      color: on ? 'var(--accent)' : 'var(--muted)', fontWeight: on ? 600 : 400,
      borderColor: on ? 'var(--accent)' : 'var(--line)',
    }}>{children}</button>
  )
  return (
    <>
      <div className="scroll" dir={t.dir}>
        <div style={{ padding: '20px 24px' }}>
          <h1 className="display" style={{ fontSize: 22, marginBottom: 10 }}>{t.theme}</h1>
          <Row label={t.theme}>
            <Pill on={theme === 'day'} onClick={() => setTheme('day')}>☀︎</Pill>
            <Pill on={theme === 'night'} onClick={() => setTheme('night')}>☾</Pill>
          </Row>
          <Row label="Language"><Pill on onClick={() => go('language')}>{LANGS.find((l) => l.id === lang)?.native}</Pill></Row>
          <Row label={t.dir === 'rtl' ? 'الموقع' : 'Website'}><Pill onClick={() => go('landing')}>{t.dir === 'rtl' ? 'الصفحة الرئيسية' : 'Home page'}</Pill></Row>
        </div>
      </div>
      <TabBar />
    </>
  )
}
