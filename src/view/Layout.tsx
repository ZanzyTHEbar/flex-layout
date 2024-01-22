import {
    createEffect,
    createSignal,
    onMount,
    type JSXElement,
    type ParentComponent,
    Component,
    onCleanup,
    createMemo,
    For,
    createRenderEffect,
} from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { Portal } from 'solid-js/web'
import { DockLocation } from '../DockLocation'
import { DragDrop } from '../DragDrop'
import DropInfo from '../DropInfo'
import { I18nLabel } from '../I18nLabel'
import { Orientation } from '../Orientation'
import { Rect } from '../Rect'
import { CLASSES } from '../Types'
import { Action } from '../model/Action'
import { Actions } from '../model/Actions'
import { BorderNode } from '../model/BorderNode'
import { BorderSet } from '../model/BorderSet'
import { IDraggable } from '../model/IDraggable'
import { IJsonTabNode } from '../model/IJsonModel'
import { Model, ILayoutMetrics } from '../model/Model'
import { Node } from '../model/Node'
import { RowNode } from '../model/RowNode'
import { SplitterNode } from '../model/SplitterNode'
import { TabNode } from '../model/TabNode'
import { TabSetNode } from '../model/TabSetNode'
import { BorderTabSet } from './BorderTabSet'
import { FloatingWindow } from './FloatingWindow'
import { FloatingWindowTab } from './FloatingWindowTab'
import { CloseIcon, EdgeIcon, MaximizeIcon, OverflowIcon, PopoutIcon, RestoreIcon } from './Icons'
import { Splitter } from './Splitter'
import { Tab } from './Tab'
import { TabButtonStamp } from './TabButtonStamp'
import { TabFloating } from './TabFloating'
import { TabSet } from './TabSet'

export type CustomDragCallback = (
    dragging: TabNode | IJsonTabNode,
    over: TabNode,
    x: number,
    y: number,
    location: DockLocation,
) => void
export type DragRectRenderCallback = (
    content: JSXElement | undefined,
    node?: Node,
    json?: IJsonTabNode,
) => JSXElement | undefined
export type FloatingTabPlaceholderRenderCallback = (
    dockPopout: () => void,
    showPopout: () => void,
) => JSXElement | undefined
export type NodeMouseEvent = (node: TabNode | TabSetNode | BorderNode, event: MouseEvent) => void
export type ShowOverflowMenuCallback = (
    node: TabSetNode | BorderNode,
    mouseEvent: MouseEvent,
    items: { index: number; node: TabNode }[],
    onSelect: (item: { index: number; node: TabNode }) => void,
) => void
export type TabSetPlaceHolderCallback = (node: TabSetNode) => JSXElement | undefined
export type IconFactory = (node: TabNode) => JSXElement | undefined
export type TitleFactory = (node: TabNode) => ITitleObject | JSXElement | undefined

export interface ILayoutProps {
    model: Model
    factory: (node: TabNode) => JSXElement | undefined
    font?: IFontValues
    fontFamily?: string
    iconFactory?: IconFactory
    titleFactory?: TitleFactory
    icons?: IIcons
    onAction?: (action: Action) => Action | undefined
    onRenderTab?: (
        node: TabNode,
        renderValues: ITabRenderValues, // change the values in this object as required
    ) => void
    onRenderTabSet?: (
        tabSetNode: TabSetNode | BorderNode,
        renderValues: ITabSetRenderValues, // change the values in this object as required
    ) => void
    onModelChange?: (model: Model, action: Action) => void
    onExternalDrag?: (event: DragEvent) =>
        | undefined
        | {
              dragText: string
              json: any
              onDrop?: (node?: JSXElement | undefined, event?: Event) => void
          }
    classMapper?: (defaultClass: string) => string
    i18nMapper?: (id: I18nLabel, param?: string) => string | undefined
    supportsPopout?: boolean | undefined
    popoutURL?: string | undefined
    realtimeResize?: boolean | undefined
    onTabDrag?: (
        dragging: TabNode | IJsonTabNode,
        over: TabNode,
        x: number,
        y: number,
        location: DockLocation,
        refresh: () => void,
    ) =>
        | undefined
        | {
              x: number
              y: number
              width: number
              height: number
              callback: CustomDragCallback
              // Called once when `callback` is not going to be called anymore (user canceled the drag, moved mouse and you returned a different callback, etc)
              invalidated?: () => void
              cursor?: string | undefined
          }
    onRenderDragRect?: DragRectRenderCallback
    onRenderFloatingTabPlaceholder?: FloatingTabPlaceholderRenderCallback
    onContextMenu?: NodeMouseEvent
    onAuxMouseClick?: NodeMouseEvent
    onShowOverflowMenu?: ShowOverflowMenuCallback
    onTabSetPlaceHolder?: TabSetPlaceHolderCallback
}
export interface IFontValues {
    size?: string
    family?: string
    style?: string
    weight?: string
}

export interface ITabSetRenderValues {
    headerContent?: JSXElement
    centerContent?: JSXElement
    stickyButtons: JSXElement[]
    buttons: JSXElement[]
    headerButtons: JSXElement[]
    // position to insert overflow button within [...stickyButtons, ...buttons]
    // if left undefined position will be after the sticky buttons (if any)
    overflowPosition: number | undefined
}

export interface ITabRenderValues {
    leading: JSXElement
    content: JSXElement
    name: string
    buttons: JSXElement[]
}

export interface ITitleObject {
    titleContent: JSXElement
    name: string
}

export interface ILayoutState {
    rect: Rect
    calculatedHeaderBarSize: number
    calculatedTabBarSize: number
    calculatedBorderBarSize: number
    editingTab?: TabNode
    showHiddenBorder: DockLocation
    portal?: typeof Portal
    showEdges?: boolean
}

export interface IIcons {
    close?: JSXElement | undefined | ((tabNode: TabNode) => JSXElement | undefined)
    closeTabset?: JSXElement | undefined | ((tabSetNode: TabSetNode) => JSXElement | undefined)
    popout?: JSXElement | undefined | ((tabNode: TabNode) => JSXElement | undefined)
    maximize?: JSXElement | undefined | ((tabSetNode: TabSetNode) => JSXElement | undefined)
    restore?: JSXElement | undefined | ((tabSetNode: TabSetNode) => JSXElement | undefined)
    more?:
        | JSXElement
        | undefined
        | ((
              tabSetNode: TabSetNode | BorderNode,
              hiddenTabs: { node: TabNode; index: number }[],
          ) => JSXElement | undefined)
    edgeArrow?: JSXElement | undefined
}

const defaultIcons = {
    close: <CloseIcon />,
    closeTabset: <CloseIcon />,
    popout: <PopoutIcon />,
    maximize: <MaximizeIcon />,
    restore: <RestoreIcon />,
    more: <OverflowIcon />,
    edgeArrow: <EdgeIcon />,
}

export interface ICustomDropDestination {
    rect: Rect
    callback: CustomDragCallback
    invalidated: (() => void) | undefined
    dragging: TabNode | IJsonTabNode
    over: TabNode
    x: number
    y: number
    location: DockLocation
    cursor: string | undefined
}

export interface ILayoutCallbacks {
    i18nName(id: I18nLabel, param?: string): string
    maximize(tabsetNode: TabSetNode): void
    getPopoutURL(): string
    isSupportsPopout(): boolean
    isRealtimeResize(): boolean
    getCurrentDocument(): Document | undefined
    getclass(defaultClass: string): string
    doAction(action: Action): Node | undefined
    getDomRect(): DOMRect | undefined
    getRootDiv(): HTMLDivElement | null
    dragStart(
        event: Event | MouseEvent | TouchEvent | DragEvent | undefined,
        dragDivText: string | undefined,
        node: Node & IDraggable,
        allowDrag: boolean,
        onClick?: (event: Event) => void,
        onDoubleClick?: (event: Event) => void,
    ): void
    customizeTab(tabNode: TabNode, renderValues: ITabRenderValues): void
    customizeTabSet(tabSetNode: TabSetNode | BorderNode, renderValues: ITabSetRenderValues): void
    styleFont: (style: Record<string, string>) => Record<string, string>
    setEditingTab(tabNode?: TabNode): void
    getEditingTab(): TabNode | undefined
    getOnRenderFloatingTabPlaceholder(): FloatingTabPlaceholderRenderCallback | undefined
    showContextMenu(node: TabNode | TabSetNode | BorderNode, event: MouseEvent): void
    auxMouseClick(node: TabNode | TabSetNode | BorderNode, event: MouseEvent): void
    showPortal: (portal: JSXElement | undefined, portalDiv: HTMLDivElement) => void
    hidePortal: () => void
    getShowOverflowMenu(): ShowOverflowMenuCallback | undefined
    getTabSetPlaceHolderCallback(): TabSetPlaceHolderCallback | undefined
}

const isDesktop =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
const defaultSupportsPopout: boolean = isDesktop

/** @internal */
interface ILayoutStateStore {
    //start: number,
    //layoutTime: number,
    previousModel: Model | undefined
    centerRect: Rect | undefined
    tabIds: string[]
    newTabJson: IJsonTabNode | undefined
    firstMove: boolean
    dragNode: (Node & IDraggable) | undefined
    dragDiv: HTMLDivElement | undefined
    dragRectRendered: boolean
    dragDivText: string | undefined
    dropInfo: DropInfo | undefined
    customDrop: ICustomDropDestination | undefined
    outlineDiv: HTMLDivElement | undefined
    edgeRectLength
    edgeRectWidth
    fnNewNodeDropped: ((node?: Node, event?: Event) => void) | undefined
    currentDocument: Document | undefined
    currentWindow: Window | undefined
    supportsPopout: boolean
    popoutURL: string
    icons: IIcons
    resizeObserver: ResizeObserver | undefined
}

const Layout: Component<ILayoutProps> = (props) => {
    //* Refs
    const [selfRef, setSelfRef] = createSignal<HTMLElement | null>()
    const [headerBarSizeRef, setHeaderBarSizeRef] = createSignal<HTMLDivElement | null>()
    const [tabBarSizeRef, setTabBarSizeRef] = createSignal<HTMLDivElement | null>()
    const [borderBarSizeRef, setBorderBarSizeRef] = createSignal<HTMLDivElement | null>()

    //* Stores
    // Create a single store for all state properties
    const [layoutStateStore, setStore] = createStore<ILayoutState>({
        rect: new Rect(0, 0, 0, 0),
        calculatedHeaderBarSize: 25,
        calculatedTabBarSize: 26,
        calculatedBorderBarSize: 30,
        editingTab: undefined,
        showHiddenBorder: DockLocation.CENTER,
        showEdges: false,
    })

    const defaultLayoutStateStore = {
        //start: 0,
        //layoutTime: 0,
        previousModel: undefined,
        centerRect: undefined,
        tabIds: [],
        newTabJson: undefined,
        firstMove: false,
        dragNode: undefined,
        dragDiv: undefined,
        dragRectRendered: true,
        dragDivText: undefined,
        dropInfo: undefined,
        customDrop: undefined,
        outlineDiv: undefined,
        edgeRectLength: 100,
        edgeRectWidth: 10,
        fnNewNodeDropped: undefined,
        currentDocument: undefined,
        currentWindow: undefined,
        supportsPopout: false,
        popoutURL: '',
        icons: defaultIcons,
        resizeObserver: undefined,
    }

    const [internalStateStore, setInternalStateStore] =
        createStore<ILayoutStateStore>(defaultLayoutStateStore)

    const layoutStore = createMemo(() => layoutStateStore)
    const internalStore = createMemo(() => internalStateStore)

    //* Lifecycle and methods

    onMount(() => {
        props.model._setChangeListener(onModelChange)

        setInternalStateStore(
            produce((draft) => {
                draft.supportsPopout =
                    props.supportsPopout !== undefined
                        ? props.supportsPopout
                        : defaultSupportsPopout
                draft.popoutURL = props.popoutURL ? props.popoutURL : 'popout.html'
                draft.icons = { ...defaultIcons, ...props.icons }
            }),
        )
    })

    onMount(() => {
        updateRect()
        updateLayoutMetrics()

        setInternalStateStore(
            produce((draft) => {
                draft.currentDocument = (selfRef()! as HTMLDivElement).ownerDocument
                draft.currentWindow = draft.currentDocument.defaultView!
                draft.resizeObserver = new ResizeObserver((entries) => {
                    updateRect(entries[0].contentRect)
                })
            }),
        )

        if (selfRef()) {
            internalStore().resizeObserver?.observe(selfRef()!)
        }

        onCleanup(() => {
            if (selfRef()) {
                internalStore().resizeObserver?.unobserve(selfRef()!)
            }
        })
    })

    createEffect(() => {
        updateLayoutMetrics()
        if (props.model !== internalStore().previousModel) {
            if (internalStore().previousModel !== undefined) {
                //! stop listening to old model
                internalStore().previousModel?._setChangeListener(undefined)
            }
            props.model._setChangeListener(onModelChange)
            setInternalStateStore(
                produce((draft) => {
                    draft.previousModel = props.model
                }),
            )
        }
    })

    // FIXME: Convert to SolidJS classList on JSX
    const styleFont = (style: Record<string, string>): Record<string, string> => {
        if (props.font) {
            if (selfRef()!) {
                if (props.font.size) {
                    selfRef()!.style.setProperty('--font-size', props.font.size)
                }
                if (props.font.family) {
                    selfRef()!.style.setProperty('--font-family', props.font.family)
                }
            }
            if (props.font.style) {
                style.fontStyle = props.font.style
            }
            if (props.font.weight) {
                style.fontWeight = props.font.weight
            }
        }
        return style
    }

    const updateRect = (domRect?: DOMRectReadOnly) => {
        // Update rect in store
        if (!domRect) {
            domRect = getDomRect()
        }
        if (!domRect) {
            return
        }
        const rect = new Rect(0, 0, domRect.width, domRect.height)
        setStore(
            produce((draft) => {
                if (rect.equals(draft.rect) && rect.width !== 0 && rect.height !== 0) {
                    draft.rect = rect
                }
            }),
        )
    }

    const updateLayoutMetrics = () => {
        // Update layout metrics in store

        if (headerBarSizeRef()) {
            const headerBarSize = headerBarSizeRef()!.getBoundingClientRect().height
            if (headerBarSize !== layoutStore().calculatedHeaderBarSize) {
                setStore(
                    produce((draft) => {
                        draft.calculatedHeaderBarSize = headerBarSize
                    }),
                )
            }
        }

        if (tabBarSizeRef()) {
            const tabBarSize = tabBarSizeRef()!.getBoundingClientRect().height
            if (tabBarSize !== layoutStore().calculatedTabBarSize) {
                setStore(
                    produce((draft) => {
                        draft.calculatedTabBarSize = tabBarSize
                    }),
                )
            }
        }

        if (borderBarSizeRef()) {
            const borderBarSize = borderBarSizeRef()!.getBoundingClientRect().height
            if (borderBarSize !== layoutStore().calculatedBorderBarSize) {
                setStore(
                    produce((draft) => {
                        draft.calculatedBorderBarSize = borderBarSize
                    }),
                )
            }
        }
    }

    const setEditingTab = (tabNode?: TabNode) => {
        setStore(
            produce((draft) => {
                draft.editingTab = tabNode
            }),
        )
    }

    // Convert event handlers and complex methods
    const onModelChange = (action: Action) => {
        // Force update logic (if needed, SolidJS might handle this reactively)
        // forceUpdate()
        // Additional logic here
        if (props.onModelChange) {
            props.onModelChange(props.model, action)
        }
    }

    // FIXME: Convert to SolidJS classList on JSX
    const getclass = (defaultClass: string) => {
        if (props.classMapper === undefined) {
            return defaultClass
        }
        return props.classMapper(defaultClass)
    }

    const getDomRect = () => {
        return selfRef()?.getBoundingClientRect()
    }

    const isRealtimeResize = () => {
        return props.realtimeResize ?? false
    }

    const onTabDrag = (...args: Parameters<Required<ILayoutProps>['onTabDrag']>) => {
        return props.onTabDrag?.(...args)
    }

    const doAction = (action: Action): Node | undefined => {
        if (props.onAction !== undefined) {
            const outcome = props.onAction(action)
            if (outcome !== undefined) {
                return props.model.doAction(outcome)
            }
            return undefined
        }
        return props.model.doAction(action)
    }

    // Additional methods and event handlers
    const onCloseWindow = (id: string) => {
        // Logic for onCloseWindow
    }

    const onSetWindow = (id: string, window: Window) => {
        // Logic for onSetWindow
    }

    // More complex rendering logic if needed
    const renderBorder = (
        borderSet: BorderSet,
        borderComponents: JSXElement | undefined[],
        tabComponents: Record<string, JSXElement | undefined>,
        floatingWindows: JSXElement | undefined[],
        splitterComponents: JSXElement | undefined[],
    ) => {
        // Adapt the renderBorder method for SolidJS
    }

    const renderChildren = () => {
        // Adapt the renderChildren method for SolidJS
    }

    // Methods for drag and drop handling
    const onDragStart = () => {
        // Adapt drag start logic
    }

    const onDragMove = () => {
        // Adapt drag move logic
    }

    const onDragEnd = () => {
        // Adapt drag end logic
    }

    createRenderEffect(() => {
        props.model._setPointerFine(
            window && window.matchMedia && window.matchMedia('(pointer: fine)').matches,
        )
        const borderComponents: JSXElement | undefined[] = []
        const tabSetComponents: JSXElement | undefined[] = []
        const floatingWindows: JSXElement | undefined[] = []
        const tabComponents: Record<string, JSXElement | undefined> = {}
        const splitterComponents: JSXElement | undefined[] = []
        const metrics: ILayoutMetrics = {
            headerBarSize: layoutStore().calculatedHeaderBarSize,
            tabBarSize: layoutStore().calculatedTabBarSize,
            borderBarSize: layoutStore().calculatedBorderBarSize,
        }
        props.model._setShowHiddenBorder(layoutStore().showHiddenBorder)
        setInternalStateStore('centerRect', props.model._layout(layoutStore().rect, metrics))

        renderBorder(
            props.model.getBorderSet(),
            borderComponents,
            tabComponents,
            floatingWindows,
            splitterComponents,
        )
        renderChildren(
            '',
            props.model.getRoot(),
            tabSetComponents,
            tabComponents,
            floatingWindows,
            splitterComponents,
        )

        const nextTopIds: string[] = []
        const nextTopIdsMap: Record<string, string> = {}

        // Keep any previous tabs in the same DOM order as before, removing any that have been deleted
        for (const t of internalStore().tabIds) {
            if (tabComponents[t]) {
                nextTopIds.push(t)
                nextTopIdsMap[t] = t
            }
        }

        setInternalStateStore('tabIds', nextTopIds)

        // Add tabs that have been added to the DOM
        for (const t of Object.keys(tabComponents)) {
            if (!nextTopIdsMap[t]) {
                internalStore().tabIds.push(t)
            }
        }

        const edges: JSXElement[] = []
        const ArrowIcon: JSXElement = internalStore().icons.edgeArrow
        if (layoutStore().showEdges) {
            const centerRect = internalStore().centerRect!
            const length = internalStore().edgeRectLength
            const width = internalStore().edgeRectWidth
            const offset = internalStore().edgeRectLength / 2
            const _class = getclass(CLASSES.FLEXLAYOUT__EDGE_RECT)
            const radius = 50
            edges.push(
                <div
                    data-key="North"
                    style={{
                        top: centerRect.y.toString(),
                        left: (centerRect.x + centerRect.width / 2 - offset).toString(),
                        width: length.toString(),
                        height: width.toString(),
                        'border-bottom-left-radius': radius.toString(),
                        'border-bottom-right-radius': radius.toString(),
                    }}
                    class={_class + ' ' + getclass(CLASSES.FLEXLAYOUT__EDGE_RECT_TOP)}>
                    <div style={{ transform: 'rotate(180deg)' }}>{ArrowIcon}</div>
                </div>,
            )
            edges.push(
                <div
                    data-key="West"
                    style={{
                        top: (centerRect.y + centerRect.height / 2 - offset).toString(),
                        left: centerRect.x.toString(),
                        width: width.toString(),
                        height: length.toString(),
                        'border-top-right-radius': radius.toString(),
                        'border-bottom-right-radius': radius.toString(),
                    }}
                    class={_class + ' ' + getclass(CLASSES.FLEXLAYOUT__EDGE_RECT_LEFT)}>
                    <div style={{ transform: 'rotate(90deg)' }}>{ArrowIcon}</div>
                </div>,
            )
            edges.push(
                <div
                    data-key="South"
                    style={{
                        top: (centerRect.y + centerRect.height - width).toString(),
                        left: (centerRect.x + centerRect.width / 2 - offset).toString(),
                        width: length.toString(),
                        height: width.toString(),
                        'border-top-left-radius': radius.toString(),
                        'border-top-right-radius': radius.toString(),
                    }}
                    class={_class + ' ' + getclass(CLASSES.FLEXLAYOUT__EDGE_RECT_BOTTOM)}>
                    <div>{ArrowIcon}</div>
                </div>,
            )
            edges.push(
                <div
                    data-key="East"
                    style={{
                        top: (centerRect.y + centerRect.height / 2 - offset).toString(),
                        left: (centerRect.x + centerRect.width - width).toString(),
                        width: width.toString(),
                        height: length.toString(),
                        'border-top-left-radius': radius.toString(),
                        'border-bottom-left-radius': radius.toString(),
                    }}
                    class={_class + ' ' + getclass(CLASSES.FLEXLAYOUT__EDGE_RECT_RIGHT)}>
                    <div style={{ transform: 'rotate(-90deg)' }}>{ArrowIcon}</div>
                </div>,
            )
        }
    })

    // Utility function
    const MetricsElements = () => {
        // TODO: Implement MetricsElements logic here

        const fontStyle = styleFont({ visibility: 'hidden' })
        return (
            <>
                <div
                    data-key="findHeaderBarSize"
                    ref={setHeaderBarSizeRef}
                    style={fontStyle}
                    class={getclass(CLASSES.FLEXLAYOUT__TABSET_HEADER_SIZER)}>
                    FindHeaderBarSize
                </div>
                <div
                    data-key="findTabBarSize"
                    ref={setTabBarSizeRef}
                    style={fontStyle}
                    class={getclass(CLASSES.FLEXLAYOUT__TABSET_SIZER)}>
                    FindTabBarSize
                </div>
                <div
                    data-key="findBorderBarSize"
                    ref={setBorderBarSizeRef}
                    style={fontStyle}
                    class={getclass(CLASSES.FLEXLAYOUT__BORDER_SIZER)}>
                    FindBorderBarSize
                </div>
            </>
        )
    }

    // Render function
    return (
        <div
            ref={setSelfRef}
            class={getclass(CLASSES.FLEXLAYOUT__LAYOUT)}
            onDragEnter={props.onExternalDrag ? onDragEnter : undefined}>
            <For each={tabSetComponents()}>{(component) => component}</For>
            <For each={tabIds()}>{(t) => tabComponents()[t]}</For>
            <For each={borderComponents()}>{(component) => component}</For>
            <For each={splitterComponents()}>{(component) => component}</For>
            <For each={edges()}>{(edge) => edge}</For>
            <For each={floatingWindows()}>{(window) => window}</For>
            <MetricsElements />
            {/* Assuming 'portal' is also managed as a reactive variable */}
            {portal()}
        </div>
    )
}

export default Layout
