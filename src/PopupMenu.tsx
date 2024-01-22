import { Component, Index, Show } from 'solid-js'
import { DragDrop } from './DragDrop'
import { CLASSES } from './Types'
import { TabNode } from './model/TabNode'
import { IconFactory, ILayoutCallbacks, TitleFactory } from './view/Layout'
import { TabButtonStamp } from './view/TabButtonStamp'

/** @internal */
export function showPopup(
    triggerElement: Element,
    items: { index: number; node: TabNode }[],
    onSelect: (item: { index: number; node: TabNode }) => void,
    layout: ILayoutCallbacks,
    iconFactory?: IconFactory,
    titleFactory?: TitleFactory,
) {
    const layoutDiv = layout.getRootDiv()
    const classMapper = layout.getclass
    const currentDocument = triggerElement.ownerDocument
    const triggerRect = triggerElement.getBoundingClientRect()
    const layoutRect = layoutDiv?.getBoundingClientRect() ?? new DOMRect(0, 0, 100, 100)

    const elm = currentDocument.createElement('div')
    elm.className = classMapper(CLASSES.FLEXLAYOUT__POPUP_MENU_CONTAINER)
    if (triggerRect.left < layoutRect.left + layoutRect.width / 2) {
        elm.style.left = triggerRect.left - layoutRect.left + 'px'
    } else {
        elm.style.right = layoutRect.right - triggerRect.right + 'px'
    }

    if (triggerRect.top < layoutRect.top + layoutRect.height / 2) {
        elm.style.top = triggerRect.top - layoutRect.top + 'px'
    } else {
        elm.style.bottom = layoutRect.bottom - triggerRect.bottom + 'px'
    }
    DragDrop.instance.addGlass(() => onHide())
    DragDrop.instance.setGlassCursorOverride('default')

    if (layoutDiv) {
        layoutDiv.appendChild(elm)
    }

    const onHide = () => {
        layout.hidePortal()
        DragDrop.instance.hideGlass()
        if (layoutDiv) {
            layoutDiv.removeChild(elm)
        }
        elm.removeEventListener('mousedown', onElementMouseDown)
        currentDocument.removeEventListener('mousedown', onDocMouseDown)
    }

    const onElementMouseDown = (event: Event) => {
        event.stopPropagation()
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onDocMouseDown = (_event: Event) => {
        onHide()
    }

    elm.addEventListener('mousedown', onElementMouseDown)
    currentDocument.addEventListener('mousedown', onDocMouseDown)

    layout.showPortal(
        <PopupMenu
            currentDocument={currentDocument}
            onSelect={onSelect}
            onHide={onHide}
            items={items}
            classMapper={classMapper}
            layout={layout}
            iconFactory={iconFactory}
            titleFactory={titleFactory}
        />,
        elm,
    )
}

/** @internal */
interface IPopupMenuProps {
    items: { index: number; node: TabNode }[]
    currentDocument: Document
    onHide: () => void
    onSelect: (item: { index: number; node: TabNode }) => void
    classMapper: (defaultClass: string) => string
    layout: ILayoutCallbacks
    iconFactory?: IconFactory
    titleFactory?: TitleFactory
}

/** @internal */
const PopupMenu: Component<IPopupMenuProps> = (props) => {
    const onItemClick = (item: { index: number; node: TabNode }, event: MouseEvent) => {
        props.onSelect(item)
        props.onHide()
        event.stopPropagation()
    }

    return (
        <div
            class={props.classMapper(CLASSES.FLEXLAYOUT__POPUP_MENU)}
            data-layout-path="/popup-menu">
            <Index each={props.items}>
                {(item, i) => (
                    <div
                        data-key={item().index}
                        class={props.classMapper(CLASSES.FLEXLAYOUT__POPUP_MENU_ITEM)}
                        data-layout-path={'/popup-menu/tb' + i}
                        onClick={(event) => onItemClick(item(), event)}
                        title={item().node.getHelpText()}>
                        <Show
                            when={item().node.getModel().isLegacyOverflowMenu()}
                            fallback={
                                <TabButtonStamp
                                    node={item().node}
                                    layout={props.layout}
                                    iconFactory={props.iconFactory}
                                    titleFactory={props.titleFactory}
                                />
                            }>
                            {item().node._getNameForOverflowMenu()}
                        </Show>
                    </div>
                )}
            </Index>
        </div>
    )
}
