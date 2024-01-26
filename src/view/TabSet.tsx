/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { I18nLabel } from '../I18nLabel'
import { Orientation } from '../Orientation'
import { showPopup } from '../PopupMenu'
import { CLASSES } from '../Types'
import { Actions } from '../model/Actions'
import { TabNode } from '../model/TabNode'
import { TabSetNode } from '../model/TabSetNode'
import { IIcons, ILayoutCallbacks, ITabSetRenderValues, ITitleObject } from './Layout'
import { TabButton } from './TabButton'
import { useTabOverflow } from './TabOverflowHook'
import { hideElement, isAuxMouseEvent } from './Utils'
import type { Component, JSXElement } from 'solid-js'

/** @internal */
export interface ITabSetProps {
    layout: ILayoutCallbacks
    node: TabSetNode
    iconFactory?: (node: TabNode) => JSXElement | undefined
    titleFactory?: (node: TabNode) => ITitleObject | JSXElement | undefined
    icons: IIcons
    editingTab?: TabNode
    path?: string
}

/** @internal */
export const TabSet = (props: ITabSetProps) => {
    const [toolbarRef, setToolbarRef] = createSignal<HTMLDivElement | null>(null)
    const [overFlowButtonRef, setOverFlowButtonRef] = createSignal<HTMLButtonElement | null>(null)
    const [tabbarInnerRef, setTabbarInnerRef] = createSignal<HTMLDivElement | null>(null)
    const [stickyButtonsRef, setStickyButtonsRef] = createSignal<HTMLDivElement | null>(null)

    const { selfRef, position, userControlledLeft, hiddenTabs, onMouseWheel, tabsTruncated } =
        useTabOverflow(props.node, Orientation.HORZ, toolbarRef, stickyButtonsRef)

    const onOverflowClick = (event: MouseEvent) => {
        const callback = props.layout.getShowOverflowMenu()
        if (callback !== undefined) {
            callback(props.node, event, hiddenTabs, onOverflowItemSelect)
        } else {
            const element = overFlowButtonRef()!
            showPopup(
                element,
                hiddenTabs,
                onOverflowItemSelect,
                props.layout,
                props.iconFactory,
                props.titleFactory,
            )
        }
        event.stopPropagation()
    }

    const onOverflowItemSelect = (item: { node: TabNode; index: number }) => {
        props.layout.doAction(Actions.selectTab(item.node.getId()))
        userControlledLeft.current = false
    }

    const onMouseDown = (event: MouseEvent | TouchEvent) => {
        if (!isAuxMouseEvent(event)) {
            let name = props.node.getName()
            if (name === undefined) {
                name = ''
            } else {
                name = ': ' + name
            }
            props.layout.doAction(Actions.setActiveTabset(props.node.getId()))
            if (!props.layout.getEditingTab()) {
                const message = props.layout.i18nName(I18nLabel.Move_Tabset, name)
                if (props.node.getModel().getMaximizedTabset() !== undefined) {
                    props.layout.dragStart(
                        event,
                        message,
                        props.node,
                        false,
                        (event2: Event) => undefined,
                        onDoubleClick,
                    )
                } else {
                    props.layout.dragStart(
                        event,
                        message,
                        props.node,
                        props.node.isEnableDrag(),
                        (event2: Event) => undefined,
                        onDoubleClick,
                    )
                }
            }
        }
    }

    const onAuxMouseClick = (event: MouseEvent) => {
        if (isAuxMouseEvent(event)) {
            props.layout.auxMouseClick(props.node, event)
        }
    }

    const onContextMenu = (event: MouseEvent) => {
        props.layout.showContextMenu(props.node, event)
    }

    const onInterceptMouseDown = (event: MouseEvent | TouchEvent) => {
        event.stopPropagation()
    }

    const onMaximizeToggle = (event: MouseEvent) => {
        if (props.node.canMaximize()) {
            props.layout.maximize(props.node)
        }
        event.stopPropagation()
    }

    const onClose = (event: MouseEvent) => {
        props.layout.doAction(Actions.deleteTabset(props.node.getId()))
        event.stopPropagation()
    }

    const onCloseTab = (event: MouseEvent) => {
        props.layout.doAction(Actions.deleteTab(props.node.getChildren()[0].getId()))
        event.stopPropagation()
    }

    const onDoubleClick = (event: Event) => {
        if (props.node.canMaximize()) {
            props.layout.maximize(props.node)
        }
    }

    const TabComponent: Component<ITabSetProps> = (props) => {
        interface ITabCompStore extends ITabSetRenderValues {
            tabbarInner: HTMLElement | null
            selectedTabNode: TabNode | null
            tabs: JSXElement[]
            style: Record<string, any> | null
            showHeader: boolean
            isTabStretch: boolean
            showClose: boolean
            headerContent: string | undefined
        }

        const initialState: ITabCompStore = {
            tabbarInner: null,
            selectedTabNode: null,
            tabs: [],
            style: null,
            showHeader: false,
            stickyButtons: [],
            buttons: [],
            headerButtons: [],
            isTabStretch: false,
            showClose: false,
            headerContent: undefined,
            overflowPosition: undefined,
        }

        const [store, setStore] = createStore<ITabCompStore>(initialState)

        const memStore = createMemo(() => store)

        let cm: ((defaultClass: string) => string) | null = null

        const Toolbar = () => {
            return (
                <div
                    ref={setToolbarRef}
                    class={cm!(CLASSES.FLEXLAYOUT__TAB_TOOLBAR)}
                    onMouseDown={onInterceptMouseDown}
                    onTouchStart={onInterceptMouseDown}
                    onDragStart={(e) => {
                        e.preventDefault()
                    }}>
                    <Show
                        when={memStore().showHeader}
                        fallback={<For each={memStore().buttons}>{(button) => button}</For>}>
                        <For each={memStore().headerButtons}>{(button) => button}</For>
                    </Show>
                </div>
            )
        }

        const TabStrip = () => {
            const tabStripStyle: { [key: string]: string } = {
                height: props.node.getTabStripHeight() + 'px',
            }

            let tabStripClasses = cm!(CLASSES.FLEXLAYOUT__TABSET_TABBAR_OUTER)

            const handleTabStringUpdate = () => {
                if (props.node.getclassTabStrip() !== undefined) {
                    tabStripClasses += ' ' + props.node.getclassTabStrip()
                }
                tabStripClasses +=
                    ' ' + CLASSES.FLEXLAYOUT__TABSET_TABBAR_OUTER_ + props.node.getTabLocation()

                if (props.node.isActive() && !memStore().showHeader) {
                    tabStripClasses += ' ' + cm!(CLASSES.FLEXLAYOUT__TABSET_SELECTED)
                }

                if (props.node.isMaximized() && !memStore().showHeader) {
                    tabStripClasses += ' ' + cm!(CLASSES.FLEXLAYOUT__TABSET_MAXIMIZED)
                }

                if (memStore().isTabStretch) {
                    const tabNode = props.node.getChildren()[0] as TabNode
                    if (tabNode.getTabSetclass() !== undefined) {
                        tabStripClasses += ' ' + tabNode.getTabSetclass()
                    }
                }
            }

            onMount(() => handleTabStringUpdate())
            createEffect(() => handleTabStringUpdate())

            return (
                <div
                    class={tabStripClasses}
                    style={tabStripStyle}
                    data-layout-path={props.path + '/tabstrip'}
                    onMouseDown={onMouseDown}
                    onContextMenu={onContextMenu}
                    onClick={onAuxMouseClick}
                    onAuxClick={onAuxMouseClick}
                    onTouchStart={onMouseDown}>
                    <div
                        ref={setTabbarInnerRef}
                        class={
                            cm!(CLASSES.FLEXLAYOUT__TABSET_TABBAR_INNER) +
                            ' ' +
                            cm!(
                                CLASSES.FLEXLAYOUT__TABSET_TABBAR_INNER_ +
                                    props.node.getTabLocation(),
                            )
                        }>
                        <div
                            style={{
                                left: position,
                                width: memStore().isTabStretch ? '100%' : '10000px',
                            }}
                            class={
                                cm!(CLASSES.FLEXLAYOUT__TABSET_TABBAR_INNER_TAB_CONTAINER) +
                                ' ' +
                                cm!(
                                    CLASSES.FLEXLAYOUT__TABSET_TABBAR_INNER_TAB_CONTAINER_ +
                                        props.node.getTabLocation(),
                                )
                            }>
                            <RenderTabs />
                            {/* {memStore().tabs} */}
                        </div>
                    </div>
                    <Toolbar />
                </div>
            )
        }

        const TabComponentContent = () => {
            let tabHeaderClasses = cm!(CLASSES.FLEXLAYOUT__TABSET_HEADER)
            let placeHolder: JSXElement = undefined

            const handleUpdate = () => {
                setStore('headerContent', props.node.getName() || '')
                if (props.node.getChildren().length === 0) {
                    const placeHolderCallback = props.layout.getTabSetPlaceHolderCallback()
                    if (placeHolderCallback) {
                        placeHolder = placeHolderCallback(props.node)
                    }
                }

                if (memStore().showHeader) {
                    if (props.node.isActive()) {
                        tabHeaderClasses += ' ' + cm!(CLASSES.FLEXLAYOUT__TABSET_SELECTED)
                    }
                    if (props.node.isMaximized()) {
                        tabHeaderClasses += ' ' + cm!(CLASSES.FLEXLAYOUT__TABSET_MAXIMIZED)
                    }
                    if (props.node.getclassHeader() !== undefined) {
                        tabHeaderClasses += ' ' + props.node.getclassHeader()
                    }
                }
            }
            onMount(() => handleUpdate())
            createEffect(() => handleUpdate())

            const Center = () => (
                <div class={cm!(CLASSES.FLEXLAYOUT__TABSET_CONTENT)}>{placeHolder}</div>
            )

            const Header = () => (
                <div
                    class={tabHeaderClasses}
                    style={{ height: props.node.getHeaderHeight() + 'px' }}
                    data-layout-path={props.path + '/header'}
                    onMouseDown={onMouseDown}
                    onContextMenu={onContextMenu}
                    onClick={onAuxMouseClick}
                    onAuxClick={onAuxMouseClick}
                    onTouchStart={onMouseDown}>
                    <div class={cm!(CLASSES.FLEXLAYOUT__TABSET_HEADER_CONTENT)}>
                        {memStore().headerContent}
                    </div>
                    <Toolbar />
                </div>
            )

            return (
                <Show
                    when={props.node.getTabLocation() === 'top'}
                    fallback={
                        <>
                            <Header />
                            <Center />
                            <TabStrip />
                        </>
                    }>
                    <>
                        <Header />
                        <TabStrip />
                        <Center />
                    </>
                </Show>
            )
        }

        const handleReactivity = () => {
            setStore('showHeader', props.node.getName() !== undefined)
            setStore('selectedTabNode', props.node.getSelectedNode() as TabNode)
            setStore('style', props.node._styleWithPosition())
            resetScrollLeft()
            if (
                props.node.getModel().getMaximizedTabset() !== undefined &&
                !props.node.isMaximized()
            ) {
                hideElement(memStore().style!, props.node.getModel().isUseVisibility())
            }

            setStore(
                'isTabStretch',
                props.node.isEnableSingleTabStretch() && props.node.getChildren().length === 1,
            )
            setStore(
                produce((draft) => {
                    const tabNode = props.node.getChildren()[0] as TabNode
                    draft.showClose =
                        (draft.isTabStretch && tabNode.isEnableClose()) ||
                        props.node.isEnableClose()
                }),
            )

            if (memStore().overflowPosition === undefined) {
                setStore('overflowPosition', memStore().stickyButtons.length)
            }

            if (memStore().stickyButtons.length > 0) {
                if (tabsTruncated || memStore().isTabStretch) {
                    setStore(
                        produce((draft) => {
                            draft.buttons.push(draft.stickyButtons)
                        }),
                    )
                } else {
                    setStore(
                        produce((draft) => {
                            draft.tabs.push(
                                <div
                                    ref={setStickyButtonsRef}
                                    onMouseDown={onInterceptMouseDown}
                                    onTouchStart={onInterceptMouseDown}
                                    onDragStart={(e) => {
                                        e.preventDefault()
                                    }}
                                    class={cm!(
                                        CLASSES.FLEXLAYOUT__TAB_TOOLBAR_STICKY_BUTTONS_CONTAINER,
                                    )}>
                                    <For each={draft.stickyButtons}>{(button) => button}</For>
                                </div>,
                            )
                        }),
                    )
                }
            }

            if (hiddenTabs.length > 0) {
                const overflowTitle = props.layout.i18nName(I18nLabel.Overflow_Menu_Tooltip)
                let overflowContent: JSXElement | undefined = undefined
                if (typeof props.icons.more === 'function') {
                    overflowContent = props.icons.more(props.node, hiddenTabs)
                } else {
                    overflowContent = (
                        <>
                            {props.icons.more}
                            <div class={cm!(CLASSES.FLEXLAYOUT__TAB_BUTTON_OVERFLOW_COUNT)}>
                                {hiddenTabs.length}
                            </div>
                        </>
                    )
                }
                setStore(
                    produce((draft) => {
                        draft.buttons.splice(
                            Math.min(draft.overflowPosition!, draft.buttons.length),
                            0,
                            <button
                                data-layout-path={props.path + '/button/overflow'}
                                ref={setOverFlowButtonRef}
                                class={
                                    cm!(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON) +
                                    ' ' +
                                    cm!(CLASSES.FLEXLAYOUT__TAB_BUTTON_OVERFLOW)
                                }
                                title={overflowTitle}
                                onClick={onOverflowClick}
                                onMouseDown={onInterceptMouseDown}
                                onTouchStart={onInterceptMouseDown}>
                                <Show when={overflowContent}>{overflowContent}</Show>
                            </button>,
                        )
                    }),
                )
            }

            if (
                memStore().selectedTabNode !== undefined &&
                props.layout.isSupportsPopout() &&
                memStore().selectedTabNode?.isEnableFloat() &&
                !memStore().selectedTabNode?.isFloating()
            ) {
                const floatTitle = props.layout.i18nName(I18nLabel.Float_Tab)
                setStore(
                    produce((draft) => {
                        draft.buttons.push(
                            <button
                                data-layout-path={props.path + '/button/float'}
                                title={floatTitle}
                                class={
                                    cm!(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON) +
                                    ' ' +
                                    cm!(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON_FLOAT)
                                }
                                onClick={onFloatTab}
                                onMouseDown={onInterceptMouseDown}
                                onTouchStart={onInterceptMouseDown}>
                                {typeof props.icons.popout === 'function'
                                    ? props.icons.popout(memStore().selectedTabNode!)
                                    : props.icons.popout}
                            </button>,
                        )
                    }),
                )
            }

            if (props.node.canMaximize()) {
                const minTitle = props.layout.i18nName(I18nLabel.Restore)
                const maxTitle = props.layout.i18nName(I18nLabel.Maximize)
                setStore(
                    produce((draft) => {
                        const btnContent = (
                            <button
                                data-layout-path={props.path + '/button/max'}
                                title={props.node.isMaximized() ? minTitle : maxTitle}
                                class={
                                    cm!(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON) +
                                    ' ' +
                                    cm!(
                                        CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON_ +
                                            (props.node.isMaximized() ? 'max' : 'min'),
                                    )
                                }
                                onClick={onMaximizeToggle}
                                onMouseDown={onInterceptMouseDown}
                                onTouchStart={onInterceptMouseDown}>
                                {props.node.isMaximized()
                                    ? typeof props.icons.restore === 'function'
                                        ? props.icons.restore(props.node)
                                        : props.icons.restore
                                    : typeof props.icons.maximize === 'function'
                                    ? props.icons.maximize(props.node)
                                    : props.icons.maximize}
                            </button>
                        )
                        if (draft.showHeader) {
                            draft.headerButtons.push(btnContent)
                            return
                        }
                        draft.buttons.push(btnContent)
                    }),
                )
            }

            if (!props.node.isMaximized() && memStore()!.showClose) {
                setStore(
                    produce((draft) => {
                        const title = draft.isTabStretch
                            ? props.layout.i18nName(I18nLabel.Close_Tab)
                            : props.layout.i18nName(I18nLabel.Close_Tabset)

                        const btnContent = (
                            <button
                                data-layout-path={props.path + '/button/close'}
                                title={title}
                                class={
                                    cm!(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON) +
                                    ' ' +
                                    cm!(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON_CLOSE)
                                }
                                onClick={draft.isTabStretch ? onCloseTab : onClose}
                                onMouseDown={onInterceptMouseDown}
                                onTouchStart={onInterceptMouseDown}>
                                {typeof props.icons.closeTabset === 'function'
                                    ? props.icons.closeTabset(props.node)
                                    : props.icons.closeTabset}
                            </button>
                        )

                        if (draft.showHeader) {
                            draft.headerButtons.push(btnContent)
                            return
                        }
                        draft.buttons.push(btnContent)
                    }),
                )
            }

            setStore('style', props.layout.styleFont(memStore().style!))
        }

        onMount(() => {
            cm = props.layout.getclass
            props.layout.customizeTabSet(props.node, memStore())
            handleReactivity()
        })

        createEffect(() => handleReactivity())

        // Logic to reset scrollLeft to 0
        const resetScrollLeft = () => {
            // tabbar inner can get shifted left via tab rename, this resets scrollLeft to 0
            if (tabbarInnerRef()! !== null && tabbarInnerRef()!.scrollLeft !== 0) {
                tabbarInnerRef()!.scrollLeft = 0
            }
        }

        const onFloatTab = (event: MouseEvent) => {
            if (memStore().selectedTabNode !== undefined) {
                props.layout.doAction(Actions.floatTab(memStore().selectedTabNode!.getId()))
            }
            event.stopPropagation()
        }

        // Handle tab logic and rendering
        const RenderTabs: Component = () => {
            return (
                <For each={props.node.getChildren()}>
                    {(child, index) => {
                        const isSelected = () => props.node.getSelected() === index()
                        return (
                            <>
                                <Show when={props.node.isEnableTabStrip()}>
                                    <TabButton
                                        layout={props.layout}
                                        node={child as TabNode}
                                        path={`${props.path}/tb${index()}`}
                                        data-index={child.getId()}
                                        selected={isSelected()}
                                        iconFactory={props.iconFactory}
                                        titleFactory={props.titleFactory}
                                        icons={props.icons}
                                    />
                                </Show>
                                <Show when={index() < props.node.getChildren().length - 1}>
                                    <div class={cm!(CLASSES.FLEXLAYOUT__TABSET_TAB_DIVIDER)} />
                                </Show>
                            </>
                        )
                    }}
                </For>
            )
        }

        return (
            <div
                ref={selfRef}
                dir="ltr"
                data-layout-path={props.path}
                class={cm!(CLASSES.FLEXLAYOUT__TABSET)}
                onWheel={onMouseWheel}
                style={{ ...memStore().style }}>
                <TabComponentContent />
            </div>
        )
    }

    return (
        <div>
            <TabComponent {...props} />
        </div>
    )
}
