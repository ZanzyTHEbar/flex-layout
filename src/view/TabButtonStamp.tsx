import * as React from 'react'
import { CLASSES } from '../Types'
import { TabNode } from '../model/TabNode'
import { IconFactory, ILayoutCallbacks, TitleFactory } from './Layout'
import { getRenderStateEx } from './Utils'

/** @internal */
export interface ITabButtonStampProps {
    node: TabNode
    layout: ILayoutCallbacks
    iconFactory?: IconFactory
    titleFactory?: TitleFactory
}

/** @internal */
export const TabButtonStamp = (props: ITabButtonStampProps) => {
    const { layout, node, iconFactory, titleFactory } = props
    const selfRef = React.useRef<HTMLDivElement | null>(null)

    const cm = layout.getclass

    const classs = cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_STAMP)

    const renderState = getRenderStateEx(layout, node, iconFactory, titleFactory)

    const content = renderState.content ? (
        <div class={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_CONTENT)}>{renderState.content}</div>
    ) : (
        node._getNameForOverflowMenu()
    )

    const leading = renderState.leading ? (
        <div class={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_LEADING)}>{renderState.leading}</div>
    ) : null

    return (
        <div ref={selfRef} class={classs} title={node.getHelpText()}>
            {leading}
            {content}
        </div>
    )
}
