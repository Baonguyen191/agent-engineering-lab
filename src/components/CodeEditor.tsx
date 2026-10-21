import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import CodeMirror from '@uiw/react-codemirror'

const extensions = [python()]

/** Python editor (CodeMirror 6). Loaded lazily by ExerciseWorkbench to keep the first page light. */
export default function CodeEditor({
  value,
  onChange,
  height = '440px',
  readOnly = false,
  label,
}: {
  value: string
  onChange?: (v: string) => void
  height?: string
  readOnly?: boolean
  label: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-code" aria-label={label}>
      <CodeMirror
        value={value}
        height={height}
        theme={oneDark}
        extensions={extensions}
        readOnly={readOnly}
        onChange={onChange}
        basicSetup={{ tabSize: 4, foldGutter: false, highlightActiveLine: !readOnly }}
        indentWithTab
      />
    </div>
  )
}
