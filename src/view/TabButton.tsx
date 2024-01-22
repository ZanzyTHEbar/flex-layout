import * as React from 'react'
import { I18nLabel } from '../I18nLabel'
import { Rect } from '../Rect'
import { CLASSES } from '../Types'
import { Actions } from '../model/Actions'
import { ICloseType } from '../model/ICloseType'
import { TabNode } from '../model/TabNode'
import { TabSetNode } from '../model/TabSetNode'
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
export const TabButton = (props: ITabButtonProps) => {
    const { layout, node, selected, iconFactory, titleFactory, icons, path } = props
    const selfRef = React.useRef<HTMLDivElement | null>(null)
    const contentRef = React.useRef<HTMLInputElement | null>(null)

    const onMouseDown = (
        event: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
    ) => {
        if (!isAuxMouseEvent(event) && !layout.getEditingTab()) {
            layout.dragStart(event, undefined, node, node.isEnableDrag(), onClick, onDoubleClick)
        }
    }

    const onAuxMouseClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (isAuxMouseEvent(event)) {
            layout.auxMouseClick(node, event)
        }
    }

    const onContextMenu = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        layout.showContextMenu(node, event)
    }

    const onClick = () => {
        layout.doAction(Actions.selectTab(node.getId()))
    }

    const onDoubleClick = (event: Event) => {
        if (node.isEnableRename()) {
            onRename()
        }
    }

    const onRename = () => {
        layout.setEditingTab(node)
        layout.getCurrentDocument()!.body.addEventListener('mousedown', onEndEdit)
        layout.getCurrentDocument()!.body.addEventListener('touchstart', onEndEdit)
    }

    const onEndEdit = (event: Event) => {
        if (event.target !== contentRef.current!) {
            layout.getCurrentDocument()!.body.removeEventListener('mousedown', onEndEdit)
            layout.getCurrentDocument()!.body.removeEventListener('touchstart', onEndEdit)
            layout.setEditingTab(undefined)
        }
    }

    const isClosable = () => {
        const closeType = node.getCloseType()
        if (selected || closeType === ICloseType.Always) {
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

    const onClose = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        if (isClosable()) {
            layout.doAction(Actions.deleteTab(node.getId()))
        } else {
            onClick()
        }
    }

    const onCloseMouseDown = (
        event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>,
    ) => {
        event.stopPropagation()
    }

    const onCloseKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        event.stopPropagation()
    }

    React.useLayoutEffect(() => {
        updateRect()
        if (layout.getEditingTab() === node) {
            ;(contentRef.current! as HTMLInputElement).select()
        }
    })

    const updateRect = () => {
        // record position of tab in node
        const layoutRect = layout.getDomRect()
        const r = selfRef.current?.getBoundingClientRect()
        if (r && layoutRect) {
            node._setTabRect(
                new Rect(r.left - layoutRect.left, r.top - layoutRect.top, r.width, r.height),
            )
        }
    }

    const onTextBoxMouseDown = (
        event: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>,
    ) => {
        // console.log("onTextBoxMouseDown");
        event.stopPropagation()
    }

    const onTextBoxKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.code === 'Escape') {
            // esc
            layout.setEditingTab(undefined)
        } else if (event.code === 'Enter') {
            // enter
            layout.setEditingTab(undefined)
            layout.doAction(
                Actions.renameTab(node.getId(), (event.target as HTMLInputElement).value),
            )
        }
    }

    const cm = layout.getclass
    const parentNode = node.getParent() as TabSetNode

    const isStretch = parentNode.isEnableSingleTabStretch() && parentNode.getChildren().length === 1
    const baseclass = isStretch
        ? CLASSES.FLEXLAYOUT__TAB_BUTTON_STRETCH
        : CLASSES.FLEXLAYOUT__TAB_BUTTON
    let classs = cm(baseclass)
    classs += ' ' + cm(baseclass + '_' + parentNode.getTabLocation())

    if (!isStretch) {
        if (selected) {
            classs += ' ' + cm(baseclass + '--selected')
        } else {
            classs += ' ' + cm(baseclass + '--unselected')
        }
    }

    if (node.getclass() !== undefined) {
        classs += ' ' + node.getclass()
    }

    const renderState = getRenderStateEx(layout, node, iconFactory, titleFactory)

    let content = renderState.content ? (
        <div class={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_CONTENT)}>{renderState.content}</div>
    ) : null

    const leading = renderState.leading ? (
        <div class={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_LEADING)}>{renderState.leading}</div>
    ) : null

    if (layout.getEditingTab() === node) {
        content = (
            <input
                ref={contentRef}
                class={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_TEXTBOX)}
                data-layout-path={path + '/textbox'}
                type="text"
                autoFocus={true}
                defaultValue={node.getName()}
                onKeyDown={onTextBoxKeyPress}
                onMouseDown={onTextBoxMouseDown}
                onTouchStart={onTextBoxMouseDown}
            />
        )
    }

    if (node.isEnableClose() && !isStretch) {
        const closeTitle = layout.i18nName(I18nLabel.Close_Tab)
        renderState.buttons.push(
            <button
                data-layout-path={path + '/button/close'}
                title={closeTitle}
                class={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_TRAILING)}
                onMouseDown={onCloseMouseDown}
                onClick={onClose}
                onTouchStart={onCloseMouseDown}
                onKeyDown={onCloseKeyDown}>
                {typeof icons.close === 'function' ? icons.close(node) : icons.close}
            </button>,
        )
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
        }
    }

    return (
        <div
            ref={selfRef}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            data-layout-path={path}
            class={classs}
            onMouseDown={onMouseDown}
            onKeyDown={onKeyDown}
            onClick={onAuxMouseClick}
            onAuxClick={onAuxMouseClick}
            onContextMenu={onContextMenu}
            onTouchStart={onMouseDown}
            title={node.getHelpText()}>
            {leading}
            {content}
            {renderState.buttons}
        </div>
    )
}
