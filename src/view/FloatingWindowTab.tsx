import * as React from 'react'
import { Fragment } from 'react'
import { I18nLabel } from '../I18nLabel'
import { CLASSES } from '../Types'
import { TabNode } from '../model/TabNode'
import { ErrorBoundary } from './ErrorBoundary'
import { ILayoutCallbacks } from './Layout'

/** @internal */
export interface IFloatingWindowTabProps {
    layout: ILayoutCallbacks
    node: TabNode
    factory: (node: TabNode) => React.ReactNode
}

/** @internal */
export const FloatingWindowTab = (props: IFloatingWindowTabProps) => {
    const { layout, node, factory } = props
    const cm = layout.getclass
    const child = factory(node)

    return (
        <div class={cm(CLASSES.FLEXLAYOUT__FLOATING_WINDOW_TAB)}>
            <ErrorBoundary message={props.layout.i18nName(I18nLabel.Error_rendering_component)}>
                <Fragment>{child}</Fragment>
            </ErrorBoundary>
        </div>
    )
}
