/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    type Component,
    type JSXElement,
    createEffect,
    createSignal,
    Show,
    onMount,
} from 'solid-js'
import { I18nLabel } from '../I18nLabel'
import { Rect } from '../Rect'
import { CLASSES } from '../Types'
import { Actions } from '../model/Actions'
import { ICloseType } from '../model/ICloseType'
import { TabNode } from '../model/TabNode'
import { TabSetNode } from '../model/TabSetNode'
import { afterPaint } from '../model/Utils'
import { IconFactory, IIcons, ILayoutCallbacks, TitleFactory } from './Layout'
import { getRenderStateEx, isAuxMouseEvent } from './Utils'

/** @internal */
export interface ITabButtonProps {
    layout: ILayoutCallbacks
    node: TabNode
    selected: boolean
    iconFactory?: IconFactory
    titleFactory?: TitleFactory
    icons: IIcons
    path: string
}

/** @internal */
export const TabButton: Component<ITabButtonProps> = (props) => {
    const [selfRef, setSelfRef] = createSignal<HTMLDivElement | null>(null)
    const [contentRef, setContentRef] = createSignal<HTMLInputElement | null>(null)
    const [classs, setClasss] = createSignal('')

    const TabButtonContent: Component = () => {
        const [renderState, setRenderState] = createSignal<{
            leading: JSXElement
            content: JSXElement
            name: string
            buttons: any[]
        }>({
            buttons: [],
            content: null,
            leading: null,
            name: '',
        })

        // Computing class names and other states
        let cm: ((defaultClass: string) => string) | null = null
        let parentNode: TabSetNode | null = null
        let isStretch: boolean = false
        let baseclass: string = ''
        let computedClass: string = ''

        const isClosable = () => {
            const closeType = props.node.getCloseType()
            if (props.selected || closeType === ICloseType.Always) {
                return true
            }
            if (closeType === ICloseType.Visible) {
                // not selected but x should be visible due to hover
                if (
                    window.matchMedia &&
                    window.matchMedia('(hover: hover) and (pointer: fine)').matches
                ) {
                    return true
                }
            }
            return false
        }

        const onClose = (event: MouseEvent) => {
            event.preventDefault()
            if (isClosable()) {
                props.layout.doAction(Actions.deleteTab(props.node.getId()))
            } else {
                onClick()
            }
        }

        const onCloseMouseDown = (event: MouseEvent | TouchEvent) => {
            event.stopPropagation()
        }

        const onCloseKeyDown = (event: KeyboardEvent) => {
            event.stopPropagation()
        }

        const onTextBoxMouseDown = (event: MouseEvent | TouchEvent) => {
            console.debug('onTextBoxMouseDown')
            event.stopPropagation()
        }

        const onTextBoxKeyPress = (event: KeyboardEvent) => {
            if (event.code === 'Escape') {
                // esc
                props.layout.setEditingTab(undefined)
            } else if (event.code === 'Enter') {
                // enter
                props.layout.setEditingTab(undefined)
                props.layout.doAction(
                    Actions.renameTab(props.node.getId(), (event.target as HTMLInputElement).value),
                )
            }
        }

        const handleStretch = () => {
            if (!isStretch) {
                computedClass += props.selected
                    ? ' ' + cm!(baseclass + '--selected')
                    : ' ' + cm!(baseclass + '--unselected')
            }

            if (props.node.getclass() !== undefined) {
                setClasss(computedClass + ' ' + props.node.getclass())
            }
        }

        onMount(() => {
            // Computing class names and other states
            cm = props.layout.getclass
            parentNode = props.node.getParent() as TabSetNode
            isStretch =
                parentNode.isEnableSingleTabStretch() && parentNode.getChildren().length === 1
            baseclass = isStretch
                ? CLASSES.FLEXLAYOUT__TAB_BUTTON_STRETCH
                : CLASSES.FLEXLAYOUT__TAB_BUTTON
            computedClass =
                cm!(baseclass) + ' ' + cm!(baseclass + '_' + parentNode.getTabLocation())
            handleStretch()
        })

        createEffect(() => {
            handleStretch()
        })

        createEffect(() => {
            setRenderState(
                getRenderStateEx(props.layout, props.node, props.iconFactory, props.titleFactory),
            )

            if (props.node.isEnableClose() && !isStretch) {
                const closeTitle = props.layout.i18nName(I18nLabel.Close_Tab)
                renderState().buttons.push(
                    <button
                        data-layout-path={props.path + '/button/close'}
                        title={closeTitle}
                        class={cm!(CLASSES.FLEXLAYOUT__TAB_BUTTON_TRAILING)}
                        onMouseDown={onCloseMouseDown}
                        onClick={onClose}
                        onTouchStart={onCloseMouseDown}
                        onKeyDown={onCloseKeyDown}>
                        {typeof props.icons.close === 'function'
                            ? props.icons.close(props.node)
                            : props.icons.close}
                    </button>,
                )
            }
        })

        return (
            <div class={classs()}>
                <Show when={renderState().leading}>
                    <div class={cm!(CLASSES.FLEXLAYOUT__TAB_BUTTON_LEADING)}>
                        {renderState().leading}
                    </div>
                </Show>
                <Show when={renderState().content}>
                    <div class={cm!(CLASSES.FLEXLAYOUT__TAB_BUTTON_CONTENT)}>
                        <Show
                            when={props.layout.getEditingTab() === props.node}
                            fallback={renderState().content}>
                            <input
                                ref={setContentRef}
                                class={cm!(CLASSES.FLEXLAYOUT__TAB_BUTTON_TEXTBOX)}
                                data-layout-path={props.path + '/textbox'}
                                type="text"
                                autofocus={true}
                                placeholder={props.node.getName()}
                                onKeyDown={onTextBoxKeyPress}
                                onMouseDown={onTextBoxMouseDown}
                                onTouchStart={onTextBoxMouseDown}
                            />
                        </Show>
                    </div>
                </Show>
                {renderState().buttons}
            </div>
        )
    }

    const onMouseDown = (event: MouseEvent | TouchEvent) => {
        if (!isAuxMouseEvent(event) && !props.layout.getEditingTab()) {
            props.layout.dragStart(
                event,
                undefined,
                props.node,
                props.node.isEnableDrag(),
                onClick,
                onDoubleClick,
            )
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

    const onClick = () => {
        props.layout.doAction(Actions.selectTab(props.node.getId()))
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onDoubleClick = (event: Event) => {
        if (props.node.isEnableRename()) {
            onRename()
        }
    }

    // TODO: use useEventListener instead
    const onRename = () => {
        props.layout.setEditingTab(props.node)
        props.layout.getCurrentDocument()!.body.addEventListener('mousedown', onEndEdit)
        props.layout.getCurrentDocument()!.body.addEventListener('touchstart', onEndEdit)
    }

    // TODO: migrate to onCleanup
    const onEndEdit = (event: Event) => {
        if (event.target !== contentRef()!) {
            props.layout.getCurrentDocument()!.body.removeEventListener('mousedown', onEndEdit)
            props.layout.getCurrentDocument()!.body.removeEventListener('touchstart', onEndEdit)
            props.layout.setEditingTab(undefined)
        }
    }

    const handleFirstPaint = () => {
        updateRect()
        if (props.layout.getEditingTab() === props.node) {
            contentRef()!.select()
        }
    }

    createEffect(() => {
        afterPaint(handleFirstPaint)
    })

    const updateRect = () => {
        // record position of tab in node
        const layoutRect = props.layout.getDomRect()
        const r = selfRef()?.getBoundingClientRect()
        if (r && layoutRect) {
            props.node._setTabRect(
                new Rect(r.left - layoutRect.left, r.top - layoutRect.top, r.width, r.height),
            )
        }
    }

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
        }
    }

    return (
        <div
            ref={setSelfRef}
            role="button"
            tabIndex={0}
            aria-pressed={props.selected}
            data-layout-path={props.path}
            class={classs()}
            onMouseDown={onMouseDown}
            onKeyDown={onKeyDown}
            onClick={onAuxMouseClick}
            onAuxClick={onAuxMouseClick}
            onContextMenu={onContextMenu}
            onTouchStart={onMouseDown}
            title={props.node.getHelpText()}>
            <TabButtonContent />
        </div>
    )
}
