import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import {
  ArrowDown,
  ArrowRight,
  CircleHelp,
  Focus,
  Info,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ABOUT_MAIN_FLOW,
  ABOUT_PERMISSION_ROWS,
  ABOUT_ROLE_DETAILS,
  ABOUT_ROLE_ORDER,
  ABOUT_SUPPORT_STAGE,
  ABOUT_WORKFLOW_STAGES,
  type AboutStageId,
  type AboutWorkflowStage,
} from '../data/aboutWorkflow'
import type { DemoDataset } from '../data/models'
import { formatNumber } from '../lib/formatters'
import '@xyflow/react/dist/style.css'
import './About.css'

type AboutFlowNodeData = {
  stage: AboutWorkflowStage
  recordCount: number
  active: boolean
  selected: boolean
  reducedMotion: boolean
  onSelect: (stageId: AboutStageId) => void
}

type AboutFlowNode = Node<AboutFlowNodeData, 'aboutWorkflow'>

function ModuleLink({
  path,
  label,
  availablePaths,
  className,
}: {
  path: string
  label: ReactNode
  availablePaths: ReadonlySet<string>
  className?: string
}) {
  if (!availablePaths.has(path)) {
    return <span className="about-module-unavailable" role="note">Not available for the active demo role</span>
  }
  return <Link className={className} to={path}>{label}</Link>
}

const edgeDefinitions: Omit<Edge, 'animated'>[] = [
  { id: 'farmer-sourcing', source: 'farmer', target: 'sourcing', sourceHandle: 'right-out', targetHandle: 'left-in', type: 'smoothstep' },
  { id: 'sourcing-grading', source: 'sourcing', target: 'grading', sourceHandle: 'right-out', targetHandle: 'left-in', type: 'smoothstep' },
  { id: 'grading-processing', source: 'grading', target: 'processing', sourceHandle: 'right-out', targetHandle: 'left-in', type: 'smoothstep' },
  { id: 'processing-storage', source: 'processing', target: 'storage', sourceHandle: 'bottom-out', targetHandle: 'top-in', type: 'smoothstep' },
  { id: 'storage-freight', source: 'storage', target: 'freight', sourceHandle: 'left-out', targetHandle: 'right-in', type: 'smoothstep' },
  { id: 'freight-retail', source: 'freight', target: 'retail', sourceHandle: 'left-out', targetHandle: 'right-in', type: 'smoothstep' },
  {
    id: 'grading-payment',
    source: 'grading',
    target: 'payments',
    sourceHandle: 'bottom-out',
    targetHandle: 'top-in',
    type: 'smoothstep',
    label: 'on acceptance',
    labelStyle: { fill: '#855a1c', fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: '#fbf7ec' },
    labelBgPadding: [5, 3],
    labelBgBorderRadius: 4,
  },
]

function WorkflowNode({ data }: NodeProps<AboutFlowNode>) {
  const Icon = data.stage.icon
  const stageAnimation = data.active && !data.reducedMotion ? [1, 1.035, 1] : 1

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: stageAnimation }}
      className={`about-flow-node${data.stage.branch ? ' is-payment' : ''}${data.active ? ' is-playing' : ''}${data.selected ? ' is-selected' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      transition={{
        opacity: { duration: 0.2 },
        y: { duration: 0.2 },
        scale: data.active && !data.reducedMotion
          ? { duration: 1.15, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.2 },
      }}
    >
      <Handle className="about-flow-handle" id="left-in" position={Position.Left} type="target" />
      <Handle className="about-flow-handle" id="right-in" position={Position.Right} type="target" />
      <Handle className="about-flow-handle" id="top-in" position={Position.Top} type="target" />
      <Handle className="about-flow-handle" id="left-out" position={Position.Left} type="source" />
      <Handle className="about-flow-handle" id="right-out" position={Position.Right} type="source" />
      <Handle className="about-flow-handle" id="bottom-out" position={Position.Bottom} type="source" />
      <button
        aria-label={`${data.stage.title}: show workflow details`}
        aria-pressed={data.selected}
        className="about-flow-node-button"
        onClick={() => data.onSelect(data.stage.id)}
        type="button"
      >
        <span className="about-flow-node-icon"><Icon aria-hidden="true" size={18} /></span>
        <span className="about-flow-node-copy">
          <strong>{data.stage.title}</strong>
          <small>{formatNumber(data.recordCount)} {data.stage.countLabel}</small>
        </span>
        {data.stage.branch
          ? <span className="about-flow-node-tag">FINANCIAL BRANCH</span>
          : <span className="about-flow-node-tag">GOODS FLOW</span>}
      </button>
    </motion.div>
  )
}

function WorkflowGraph({ data, availablePaths }: { data: DemoDataset; availablePaths: ReadonlySet<string> }) {
  const reducedMotion = useReducedMotion() ?? false
  const { fitView } = useReactFlow()
  const nodeTypes = useMemo(() => ({ aboutWorkflow: WorkflowNode }), [])
  const [selectedStageId, setSelectedStageId] = useState<AboutStageId>('farmer')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)

  const onSelectStage = useCallback((stageId: AboutStageId) => {
    setSelectedStageId(stageId)
    setIsPlaying(false)
    setActiveIndex(ABOUT_MAIN_FLOW.indexOf(stageId))
  }, [])

  const activeStageId = activeIndex >= 0 ? ABOUT_MAIN_FLOW[activeIndex] : null
  const nodes = useMemo<AboutFlowNode[]>(() => ABOUT_WORKFLOW_STAGES.map((stage) => ({
    id: stage.id,
    type: 'aboutWorkflow',
    position: stage.position,
    data: {
      stage,
      recordCount: stage.count(data),
      active: stage.id === activeStageId,
      selected: stage.id === selectedStageId,
      reducedMotion,
      onSelect: onSelectStage,
    },
  })), [activeStageId, data, onSelectStage, reducedMotion, selectedStageId])

  const edges = useMemo<Edge[]>(() => edgeDefinitions.map((edge) => ({
    ...edge,
    animated: isPlaying && !reducedMotion,
    markerEnd: { type: MarkerType.ArrowClosed, color: edge.id === 'grading-payment' ? '#b77b28' : '#71856e' },
    style: {
      stroke: edge.id === 'grading-payment' ? '#b77b28' : '#71856e',
      strokeWidth: 2,
      ...(edge.id === 'grading-payment' ? { strokeDasharray: '5 4' } : {}),
    },
  })), [isPlaying, reducedMotion])

  useEffect(() => {
    if (!isPlaying) return

    const timer = window.setTimeout(() => {
      if (activeIndex >= ABOUT_MAIN_FLOW.length - 1) {
        setIsPlaying(false)
        return
      }
      const nextIndex = activeIndex + 1
      setActiveIndex(nextIndex)
      setSelectedStageId(ABOUT_MAIN_FLOW[nextIndex])
    }, reducedMotion ? 1800 : 1250)

    return () => window.clearTimeout(timer)
  }, [activeIndex, isPlaying, reducedMotion])

  const selectedStage = ABOUT_WORKFLOW_STAGES.find((stage) => stage.id === selectedStageId) ?? ABOUT_WORKFLOW_STAGES[0]
  const SelectedIcon = selectedStage.icon
  const selectedIndex = ABOUT_MAIN_FLOW.indexOf(selectedStageId)

  function startPlayback() {
    if (activeIndex >= ABOUT_MAIN_FLOW.length - 1) {
      setActiveIndex(0)
      setSelectedStageId(ABOUT_MAIN_FLOW[0])
    }
    setIsPlaying(true)
  }

  function replay() {
    setActiveIndex(0)
    setSelectedStageId(ABOUT_MAIN_FLOW[0])
    setIsPlaying(true)
  }

  function stepBy(offset: -1 | 1) {
    setIsPlaying(false)
    const nextIndex = Math.max(0, Math.min(ABOUT_MAIN_FLOW.length - 1, (selectedIndex < 0 ? 0 : selectedIndex) + offset))
    const nextStage = ABOUT_MAIN_FLOW[nextIndex]
    setActiveIndex(nextIndex)
    setSelectedStageId(nextStage)
  }

  return (
    <section aria-labelledby="workflow-title" className="about-panel about-workflow-panel">
      <div className="about-panel-heading">
        <div>
          <p className="eyebrow">HOW THE DEMO CONNECTS</p>
          <h2 id="workflow-title">A batch journey, with payment alongside acceptance</h2>
          <p>Every count comes from the same synthetic records used by the operational modules.</p>
        </div>
        <span className="about-demo-mark">SYNTHETIC RECORDS</span>
      </div>

      <div className="about-playback-controls" aria-label="Workflow animation controls">
        <button className="subtle-button" onClick={() => stepBy(-1)} type="button" aria-label="Previous workflow step" disabled={selectedIndex <= 0}>
          <SkipBack aria-hidden="true" size={15} /> Previous
        </button>
        {isPlaying
          ? <button className="primary-button" onClick={() => setIsPlaying(false)} type="button"><Pause aria-hidden="true" size={15} /> Pause</button>
          : <button className="primary-button" onClick={startPlayback} type="button"><Play aria-hidden="true" size={15} /> Play flow</button>}
        <button className="subtle-button" onClick={replay} type="button" aria-label="Replay workflow from the first step">
          <RotateCcw aria-hidden="true" size={15} /> Replay
        </button>
        <button className="subtle-button" onClick={() => stepBy(1)} type="button" aria-label="Next workflow step" disabled={selectedIndex >= ABOUT_MAIN_FLOW.length - 1}>
          Next <SkipForward aria-hidden="true" size={15} />
        </button>
        <button className="subtle-button about-reset-view" onClick={() => fitView({ padding: 0.16 })} type="button">
          <Focus aria-hidden="true" size={15} /> Reset view
        </button>
        {reducedMotion && <span className="about-motion-note">Reduced motion preference is respected.</span>}
      </div>

      <div className="about-flow-canvas" role="group" aria-label="Interactive supply-chain workflow diagram">
        <ReactFlow
          aria-label="Supply-chain steps. Select a step to open its details."
          fitView
          fitViewOptions={{ padding: 0.16, minZoom: 0.55, maxZoom: 1.15 }}
          edges={edges}
          nodes={nodes}
          nodeTypes={nodeTypes}
          nodesConnectable={false}
          nodesDraggable={false}
          panOnDrag
          zoomOnDoubleClick={false}
        >
          <Background color="#dce4d6" gap={18} size={1} variant={BackgroundVariant.Dots} />
          <Controls aria-label="Workflow diagram zoom controls" showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="about-mobile-flow" aria-label="Supply-chain workflow steps">
        <ol>
          {ABOUT_MAIN_FLOW.map((stageId) => {
            const stage = ABOUT_WORKFLOW_STAGES.find((candidate) => candidate.id === stageId)!
            const Icon = stage.icon
            return (
              <li key={stage.id}>
                <span className="about-mobile-step-icon"><Icon aria-hidden="true" size={16} /></span>
                <span><strong>{stage.title}</strong><small>{stage.description}</small></span>
                <ModuleLink availablePaths={availablePaths} label="Open" path={stage.path} />
              </li>
            )
          })}
        </ol>
        <div className="about-mobile-payment">
          <ArrowDown aria-hidden="true" size={15} />
          <div><strong>From acceptance: Farmer payment</strong><p>{ABOUT_WORKFLOW_STAGES.find((stage) => stage.id === 'payments')?.description}</p></div>
          <ModuleLink availablePaths={availablePaths} label="Open payments" path="/farmer-payments" />
        </div>
      </div>

      <div className="about-cross-cutting">
        <span className="about-cross-cut-icon"><TraceabilityIcon aria-hidden="true" size={18} /></span>
        <div>
          <span className="about-flow-node-tag">CROSS-CUTTING · NOT A PHYSICAL STEP</span>
          <h3>{ABOUT_SUPPORT_STAGE.title}</h3>
          <p>{ABOUT_SUPPORT_STAGE.description}</p>
        </div>
        <ModuleLink
          availablePaths={availablePaths}
          className="subtle-button"
          label={<>Explore traceability <ArrowRight aria-hidden="true" size={15} /></>}
          path={ABOUT_SUPPORT_STAGE.path}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="about-stage-detail"
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          key={selectedStageId}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
        >
          <div className="about-stage-detail-icon"><SelectedIcon aria-hidden="true" size={19} /></div>
          <div className="about-stage-detail-copy">
            <p className="eyebrow">SELECTED STEP · {selectedStage.responsibility}</p>
            <h3>{selectedStage.title}</h3>
            <p>{selectedStage.description}</p>
            <small>{formatNumber(selectedStage.count(data))} {selectedStage.countLabel} in the shared demo dataset</small>
          </div>
          <ModuleLink
            availablePaths={availablePaths}
            className="primary-button"
            label={<>Open module <ArrowRight aria-hidden="true" size={15} /></>}
            path={selectedStage.path}
          />
        </motion.div>
      </AnimatePresence>
    </section>
  )
}

function WorkflowDiagram({ data, availablePaths }: { data: DemoDataset; availablePaths: ReadonlySet<string> }) {
  return (
    <ReactFlowProvider>
      <WorkflowGraph availablePaths={availablePaths} data={data} />
    </ReactFlowProvider>
  )
}

export default function About({ data, availablePaths }: { data: DemoDataset; availablePaths: readonly string[] }) {
  const allowedPaths = useMemo(() => new Set(availablePaths), [availablePaths])
  return (
    <MotionConfig reducedMotion="user">
      <div className="about-page">
        <section className="about-intro" aria-labelledby="about-intro-title">
          <div className="about-intro-icon"><CircleHelp aria-hidden="true" size={22} /></div>
          <div>
            <p className="eyebrow">ABOUT THIS PROTOTYPE</p>
            <h2 id="about-intro-title">A proposed supply-chain command centre</h2>
            <p>Vayal-to-Vaasal is a stakeholder-facing concept from Pirai Infotech. It illustrates how synthetic records might connect agricultural sourcing, processing and distribution; it is not a deployed government platform.</p>
          </div>
          <span className="about-proposal-badge"><Info aria-hidden="true" size={14} /> Proposal · not deployed</span>
        </section>

        <section className="about-role-section" aria-labelledby="role-section-title">
          <div className="about-section-heading">
            <div>
              <p className="eyebrow">DEMO ROLES</p>
              <h2 id="role-section-title">Who the concept is designed to support</h2>
            </div>
            <span>Role switching is a frontend demonstration only.</span>
          </div>

          <div className="about-role-cards">
            {ABOUT_ROLE_ORDER.map((role) => {
              const roleDetails = ABOUT_ROLE_DETAILS[role]
              return (
                <article className="about-role-card" key={role}>
                  <span className="about-role-icon"><ShieldAlert aria-hidden="true" size={17} /></span>
                  <h3>{roleDetails.title}</h3>
                  <p>{roleDetails.responsibility}</p>
                </article>
              )
            })}
          </div>

          <div className="about-panel about-permission-panel">
            <div className="about-panel-heading">
              <div>
                <h3>Documented responsibilities, not an authorization policy</h3>
                <p>The role needs below are stated in the requirements. They describe intended support—not approved permissions.</p>
              </div>
              <span className="about-demo-mark">UI PERMISSIONS ARE SIMULATED</span>
            </div>
            <div className="about-permission-table-wrap" role="region" aria-label="Demo roles and documented responsibilities" tabIndex={0}>
              <table className="about-permission-table">
                <thead>
                  <tr>
                    <th scope="col">Responsibility / policy area</th>
                    {ABOUT_ROLE_ORDER.map((role) => <th key={role} scope="col">{ABOUT_ROLE_DETAILS[role].title}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ABOUT_PERMISSION_ROWS.map((row) => (
                    <tr key={row.area}>
                      <th scope="row">{row.area}</th>
                      {ABOUT_ROLE_ORDER.map((role) => (
                        <td className={row.permissions[role] === 'Not defined' ? 'is-not-defined' : 'is-documented'} key={role}>
                          {row.permissions[role]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="about-security-note" role="note">
              <ShieldAlert aria-hidden="true" size={17} />
              <p><strong>Frontend demo only.</strong> The role switcher changes which screens and controls are shown in this browser. It provides no authentication, server-side authorization or production security. Specific create, edit, approval and cross-district rules remain <strong>Not defined</strong>.</p>
            </div>
          </div>
        </section>

        <WorkflowDiagram availablePaths={allowedPaths} data={data} />

        <section className="about-disclosure" aria-labelledby="about-disclosure-title">
          <Info aria-hidden="true" size={17} />
          <div>
            <h2 id="about-disclosure-title">Data, ownership and integration boundaries</h2>
            <p>All transactional examples are synthetic demo data. The Government of Tamil Nadu is the intended owner of the proposed platform, data and brand; this prototype does not imply government endorsement, deployment, or live integration. QR identifiers resolve to modeled records only and do not prove authenticity. Movement statuses and routes are simulated; the prototype audit trail is not an immutable ledger.</p>
          </div>
        </section>
      </div>
    </MotionConfig>
  )
}

const TraceabilityIcon = ABOUT_SUPPORT_STAGE.icon
