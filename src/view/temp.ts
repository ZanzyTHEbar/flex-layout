
export class Layout extends Component<ILayoutProps, ILayoutState> {

    private previousModel?: Model;

    private centerRect?: Rect;


    // private start: number = 0;

    // private layoutTime: number = 0;


    private tabIds: string[];

    private newTabJson: IJsonTabNode | undefined;

    private firstMove: boolean = false;

    private dragNode?: Node & IDraggable;

    private dragDiv?: HTMLDivElement;

    private dragRectRendered: boolean = true;

    private dragDivText: string | undefined = undefined;

    private dropInfo: DropInfo | undefined;

    private customDrop: ICustomDropDestination | undefined;

    private outlineDiv?: HTMLDivElement;

    private edgeRectLength = 100;

    private edgeRectWidth = 10;

    private fnNewNodeDropped?: (node?: Node, event?: Event) => void;

    private currentDocument?: Document;

    private currentWindow?: Window;

    private supportsPopout: boolean;

    private popoutURL: string;

    private icons: IIcons;

    private resizeObserver?: ResizeObserver;

    constructor(props: ILayoutProps) {
        super(props);
        this.props.model._setChangeListener(this.onModelChange);
        this.tabIds = [];
        this.selfRef = createRef<HTMLDivElement>();
        this.findHeaderBarSizeRef = createRef<HTMLDivElement>();
        this.findTabBarSizeRef = createRef<HTMLDivElement>();
        this.findBorderBarSizeRef = createRef<HTMLDivElement>();
        this.supportsPopout = props.supportsPopout !== undefined ? props.supportsPopout : defaultSupportsPopout;
        this.popoutURL = props.popoutURL ? props.popoutURL : "popout.html";
        this.icons = { ...defaultIcons, ...props.icons };

        this.state = {
            rect: new Rect(0, 0, 0, 0),
            calculatedHeaderBarSize: 25,
            calculatedTabBarSize: 26,
            calculatedBorderBarSize: 30,
            editingTab: undefined,
            showHiddenBorder: DockLocation.CENTER,
            showEdges: false,
        };

        this.onDragEnter = this.onDragEnter.bind(this);
    }


    styleFont(style: Record<string, string>): Record<string, string> {
        if (this.props.font) {
            if (this.selfRef.current) {
                if (this.props.font.size) {
                    this.selfRef.current.style.setProperty("--font-size", this.props.font.size);
                }
                if (this.props.font.family) {
                    this.selfRef.current.style.setProperty("--font-family", this.props.font.family);
                }
            }
            if (this.props.font.style) {
                style.fontStyle = this.props.font.style;
            }
            if (this.props.font.weight) {
                style.fontWeight = this.props.font.weight;
            }
        }
        return style;
    }


    onModelChange = (action: Action) => {
        this.forceUpdate();
        if (this.props.onModelChange) {
            this.props.onModelChange(this.props.model, action);
        }
    };


    doAction(action: Action): Node | undefined {
        if (this.props.onAction !== undefined) {
            const outcome = this.props.onAction(action);
            if (outcome !== undefined) {
                return this.props.model.doAction(outcome);
            }
            return undefined;
        } else {
            return this.props.model.doAction(action);
        }
    }


    componentDidMount() {
        this.updateRect();
        this.updateLayoutMetrics();

        // need to re-render if size changes
        this.currentDocument = (this.selfRef.current as HTMLDivElement).ownerDocument;
        this.currentWindow = this.currentDocument.defaultView!;
        this.resizeObserver = new ResizeObserver((entries) => {
            this.updateRect(entries[0].contentRect);
        });
        const selfRefCurr = this.selfRef.current;
        if (selfRefCurr) {
            this.resizeObserver.observe(selfRefCurr);
        }
    }


    componentDidUpdate() {
        this.updateLayoutMetrics();
        if (this.props.model !== this.previousModel) {
            if (this.previousModel !== undefined) {
                this.previousModel._setChangeListener(undefined); // stop listening to old model
            }
            this.props.model._setChangeListener(this.onModelChange);
            this.previousModel = this.props.model;
        }
        // console.log("Layout time: " + this.layoutTime + "ms Render time: " + (Date.now() - this.start) + "ms");
    }


    updateRect = (domRect?: DOMRectReadOnly) => {
        if (!domRect) {
            domRect = this.getDomRect();
        }
        if (!domRect) {
            // no dom rect available, return.
            return;
        }
        const rect = new Rect(0, 0, domRect.width, domRect.height);
        if (!rect.equals(this.state.rect) && rect.width !== 0 && rect.height !== 0) {
            this.setState({ rect });
        }
    };


    updateLayoutMetrics = () => {
        if (this.findHeaderBarSizeRef.current) {
            const headerBarSize = this.findHeaderBarSizeRef.current.getBoundingClientRect().height;
            if (headerBarSize !== this.state.calculatedHeaderBarSize) {
                this.setState({ calculatedHeaderBarSize: headerBarSize });
            }
        }
        if (this.findTabBarSizeRef.current) {
            const tabBarSize = this.findTabBarSizeRef.current.getBoundingClientRect().height;
            if (tabBarSize !== this.state.calculatedTabBarSize) {
                this.setState({ calculatedTabBarSize: tabBarSize });
            }
        }
        if (this.findBorderBarSizeRef.current) {
            const borderBarSize = this.findBorderBarSizeRef.current.getBoundingClientRect().height;
            if (borderBarSize !== this.state.calculatedBorderBarSize) {
                this.setState({ calculatedBorderBarSize: borderBarSize });
            }
        }
    };


    getclass = (defaultclass: string) => {
        if (this.props.classMapper === undefined) {
            return defaultclass;
        } else {
            return this.props.classMapper(defaultclass);
        }
    };


    getCurrentDocument() {
        return this.currentDocument;
    }


    getDomRect() {
        return this.selfRef.current?.getBoundingClientRect();
    }


    getRootDiv() {
        return this.selfRef.current;
    }


    isSupportsPopout() {
        return this.supportsPopout;
    }


    isRealtimeResize() {
        return this.props.realtimeResize ?? false;
    }


    onTabDrag(...args: Parameters<Required<ILayoutProps>["onTabDrag"]>) {
        return this.props.onTabDrag?.(...args);
    }


    getPopoutURL() {
        return this.popoutURL;
    }


    componentWillUnmount() {
        const selfRefCurr = this.selfRef.current;
        if (selfRefCurr) {
            this.resizeObserver?.unobserve(selfRefCurr);
        }
    }


    setEditingTab(tabNode?: TabNode) {
        this.setState({ editingTab: tabNode });
    }


    getEditingTab() {
        return this.state.editingTab;
    }


    render() {
        // first render will be used to find the size (via selfRef)
        if (!this.selfRef.current) {
            return (
                <div ref={this.selfRef} class={this.getclass(CLASSES.FLEXLAYOUT__LAYOUT)}>
                    {this.metricsElements()}
                </div>
            );
        }

        this.props.model._setPointerFine(window && window.matchMedia && window.matchMedia("(pointer: fine)").matches);
        // this.start = Date.now();
        const borderComponents: JSXElement | undefined[] = [];
        const tabSetComponents: JSXElement | undefined[] = [];
        const floatingWindows: JSXElement | undefined[] = [];
        const tabComponents: Record<string, JSXElement | undefined> = {};
        const splitterComponents: JSXElement | undefined[] = [];

        const metrics: ILayoutMetrics = {
            headerBarSize: this.state.calculatedHeaderBarSize,
            tabBarSize: this.state.calculatedTabBarSize,
            borderBarSize: this.state.calculatedBorderBarSize,
        };
        this.props.model._setShowHiddenBorder(this.state.showHiddenBorder);

        this.centerRect = this.props.model._layout(this.state.rect, metrics);

        this.renderBorder(this.props.model.getBorderSet(), borderComponents, tabComponents, floatingWindows, splitterComponents);
        this.renderChildren("", this.props.model.getRoot(), tabSetComponents, tabComponents, floatingWindows, splitterComponents);

        const nextTopIds: string[] = [];
        const nextTopIdsMap: Record<string, string> = {};

        // Keep any previous tabs in the same DOM order as before, removing any that have been deleted
        for (const t of this.tabIds) {
            if (tabComponents[t]) {
                nextTopIds.push(t);
                nextTopIdsMap[t] = t;
            }
        }
        this.tabIds = nextTopIds;

        // Add tabs that have been added to the DOM
        for (const t of Object.keys(tabComponents)) {
            if (!nextTopIdsMap[t]) {
                this.tabIds.push(t);
            }
        }

        const edges: JSXElement | undefined[] = [];
        const arrowIcon = this.icons.edgeArrow;
        if (this.state.showEdges) {
            const r = this.centerRect;
            const length = this.edgeRectLength;
            const width = this.edgeRectWidth;
            const offset = this.edgeRectLength / 2;
            const class = this.getclass(CLASSES.FLEXLAYOUT__EDGE_RECT);
            const radius = 50;
            edges.push(
                <div
                    key="North"
                    style={{ top: r.y, left: r.x + r.width / 2 - offset, width: length, height: width, borderBottomLeftRadius: radius, borderBottomRightRadius: radius }}
                    class={class + " " + this.getclass(CLASSES.FLEXLAYOUT__EDGE_RECT_TOP)}
                >
                    <div style={{ transform: "rotate(180deg)" }}>{arrowIcon}</div>
                </div>,
            );
            edges.push(
                <div
                    key="West"
                    style={{ top: r.y + r.height / 2 - offset, left: r.x, width: width, height: length, borderTopRightRadius: radius, borderBottomRightRadius: radius }}
                    class={class + " " + this.getclass(CLASSES.FLEXLAYOUT__EDGE_RECT_LEFT)}
                >
                    <div style={{ transform: "rotate(90deg)" }}>{arrowIcon}</div>
                </div>,
            );
            edges.push(
                <div
                    key="South"
                    style={{ top: r.y + r.height - width, left: r.x + r.width / 2 - offset, width: length, height: width, borderTopLeftRadius: radius, borderTopRightRadius: radius }}
                    class={class + " " + this.getclass(CLASSES.FLEXLAYOUT__EDGE_RECT_BOTTOM)}
                >
                    <div>{arrowIcon}</div>
                </div>,
            );
            edges.push(
                <div
                    key="East"
                    style={{ top: r.y + r.height / 2 - offset, left: r.x + r.width - width, width: width, height: length, borderTopLeftRadius: radius, borderBottomLeftRadius: radius }}
                    class={class + " " + this.getclass(CLASSES.FLEXLAYOUT__EDGE_RECT_RIGHT)}
                >
                    <div style={{ transform: "rotate(-90deg)" }}>{arrowIcon}</div>
                </div>,
            );
        }

        // this.layoutTime = (Date.now() - this.start);

        return (
            <div ref={this.selfRef} class={this.getclass(CLASSES.FLEXLAYOUT__LAYOUT)} onDragEnter={this.props.onExternalDrag ? this.onDragEnter : undefined}>
                {tabSetComponents}
                {this.tabIds.map((t) => {
                    return tabComponents[t];
                })}
                {borderComponents}
                {splitterComponents}
                {edges}
                {floatingWindows}
                {this.metricsElements()}
                {this.state.portal}
            </div>
        );
    }


    metricsElements() {
        // used to measure the tab and border tab sizes
        const fontStyle = this.styleFont({ visibility: "hidden" });
        return (
            <Fragment>
                <div key="findHeaderBarSize" ref={this.findHeaderBarSizeRef} style={fontStyle} class={this.getclass(CLASSES.FLEXLAYOUT__TABSET_HEADER_SIZER)}>
                    FindHeaderBarSize
                </div>
                <div key="findTabBarSize" ref={this.findTabBarSizeRef} style={fontStyle} class={this.getclass(CLASSES.FLEXLAYOUT__TABSET_SIZER)}>
                    FindTabBarSize
                </div>
                <div key="findBorderBarSize" ref={this.findBorderBarSizeRef} style={fontStyle} class={this.getclass(CLASSES.FLEXLAYOUT__BORDER_SIZER)}>
                    FindBorderBarSize
                </div>
            </Fragment>
        );
    }


    onCloseWindow = (id: string) => {
        this.doAction(Actions.unFloatTab(id));
        try {
            (this.props.model.getNodeById(id) as TabNode)._setWindow(undefined);
        } catch (e) {
            // catch incase it was a model change
        }
    };


    onSetWindow = (id: string, window: Window) => {
        (this.props.model.getNodeById(id) as TabNode)._setWindow(window);
    };


    renderBorder(borderSet: BorderSet, borderComponents: JSXElement | undefined[], tabComponents: Record<string, JSXElement | undefined>, floatingWindows: JSXElement | undefined[], splitterComponents: JSXElement | undefined[]) {
        for (const border of borderSet.getBorders()) {
            const borderPath = `/border/${border.getLocation().getName()}`;
            if (border.isShowing()) {
                borderComponents.push(
                    <BorderTabSet
                        key={`border_${border.getLocation().getName()}`}
                        path={borderPath}
                        border={border}
                        layout={this}
                        iconFactory={this.props.iconFactory}
                        titleFactory={this.props.titleFactory}
                        icons={this.icons}
                    />,
                );
                const drawChildren = border._getDrawChildren();
                let i = 0;
                let tabCount = 0;
                for (const child of drawChildren) {
                    if (child instanceof SplitterNode) {
                        const path = borderPath + "/s";
                        splitterComponents.push(<Splitter key={child.getId()} layout={this} node={child} path={path} />);
                    } else if (child instanceof TabNode) {
                        const path = borderPath + "/t" + tabCount++;
                        if (this.supportsPopout && child.isFloating()) {
                            const rect = this._getScreenRect(child);

                            const tabBorderWidth = child._getAttr("borderWidth");
                            const tabBorderHeight = child._getAttr("borderHeight");
                            if (rect) {
                                if (tabBorderWidth !== -1 && border.getLocation().getOrientation() === Orientation.HORZ) {
                                    rect.width = tabBorderWidth;
                                } else if (tabBorderHeight !== -1 && border.getLocation().getOrientation() === Orientation.VERT) {
                                    rect.height = tabBorderHeight;
                                }
                            }

                            floatingWindows.push(
                                <FloatingWindow
                                    key={child.getId()}
                                    url={this.popoutURL}
                                    rect={rect}
                                    title={child.getName()}
                                    id={child.getId()}
                                    onSetWindow={this.onSetWindow}
                                    onCloseWindow={this.onCloseWindow}
                                >
                                    <FloatingWindowTab layout={this} node={child} factory={this.props.factory} />
                                </FloatingWindow>,
                            );
                            tabComponents[child.getId()] = <TabFloating key={child.getId()} layout={this} path={path} node={child} selected={i === border.getSelected()} />;
                        } else {
                            tabComponents[child.getId()] = <Tab key={child.getId()} layout={this} path={path} node={child} selected={i === border.getSelected()} factory={this.props.factory} />;
                        }
                    }
                    i++;
                }
            }
        }
    }


    renderChildren(
        path: string,
        node: RowNode | TabSetNode,
        tabSetComponents: JSXElement | undefined[],
        tabComponents: Record<string, JSXElement | undefined>,
        floatingWindows: JSXElement | undefined[],
        splitterComponents: JSXElement | undefined[],
    ) {
        const drawChildren = node._getDrawChildren();
        let splitterCount = 0;
        let tabCount = 0;
        let rowCount = 0;

        for (const child of drawChildren!) {
            if (child instanceof SplitterNode) {
                const newPath = path + "/s" + splitterCount++;
                splitterComponents.push(<Splitter key={child.getId()} layout={this} path={newPath} node={child} />);
            } else if (child instanceof TabSetNode) {
                const newPath = path + "/ts" + rowCount++;
                tabSetComponents.push(
                    <TabSet key={child.getId()} layout={this} path={newPath} node={child} iconFactory={this.props.iconFactory} titleFactory={this.props.titleFactory} icons={this.icons} />,
                );
                this.renderChildren(newPath, child, tabSetComponents, tabComponents, floatingWindows, splitterComponents);
            } else if (child instanceof TabNode) {
                const newPath = path + "/t" + tabCount++;
                const selectedTab = child.getParent()!.getChildren()[(child.getParent() as TabSetNode).getSelected()];
                if (selectedTab === undefined) {
                    // this should not happen!
                    console.warn("undefined selectedTab should not happen");
                }
                if (this.supportsPopout && child.isFloating()) {
                    const rect = this._getScreenRect(child);
                    floatingWindows.push(
                        <FloatingWindow
                            key={child.getId()}
                            url={this.popoutURL}
                            rect={rect}
                            title={child.getName()}
                            id={child.getId()}
                            onSetWindow={this.onSetWindow}
                            onCloseWindow={this.onCloseWindow}
                        >
                            <FloatingWindowTab layout={this} node={child} factory={this.props.factory} />
                        </FloatingWindow>,
                    );
                    tabComponents[child.getId()] = <TabFloating key={child.getId()} layout={this} path={newPath} node={child} selected={child === selectedTab} />;
                } else {
                    tabComponents[child.getId()] = <Tab key={child.getId()} layout={this} path={newPath} node={child} selected={child === selectedTab} factory={this.props.factory} />;
                }
            } else {
                // is row
                const newPath = path + (child.getOrientation() === Orientation.HORZ ? "/r" : "/c") + rowCount++;
                this.renderChildren(newPath, child as RowNode, tabSetComponents, tabComponents, floatingWindows, splitterComponents);
            }
        }
    }


    _getScreenRect(node: TabNode) {
        const rect = node!.getRect()!.clone();
        const bodyRect: DOMRect | undefined = this.selfRef.current?.getBoundingClientRect();
        if (!bodyRect) {
            return null;
        }
        const navHeight = Math.min(80, this.currentWindow!.outerHeight - this.currentWindow!.innerHeight);
        const navWidth = Math.min(80, this.currentWindow!.outerWidth - this.currentWindow!.innerWidth);
        rect.x = rect.x + bodyRect.x + this.currentWindow!.screenX + navWidth;
        rect.y = rect.y + bodyRect.y + this.currentWindow!.screenY + navHeight;
        return rect;
    }

   
    addTabToTabSet(tabsetId: string, json: IJsonTabNode): TabNode | undefined {
        const tabsetNode = this.props.model.getNodeById(tabsetId);
        if (tabsetNode !== undefined) {
            const node = this.doAction(Actions.addNode(json, tabsetId, DockLocation.CENTER, -1));
            return node as TabJSXElement;
        }
        return undefined;
    }

   
    addTabToActiveTabSet(json: IJsonTabNode): TabNode | undefined {
        const tabsetNode = this.props.model.getActiveTabset();
        if (tabsetNode !== undefined) {
            const node = this.doAction(Actions.addNode(json, tabsetNode.getId(), DockLocation.CENTER, -1));
            return node as TabJSXElement;
        }
        return undefined;
    }


    addTabWithDragAndDrop(dragText: string | undefined, json: IJsonTabNode, onDrop?: (node?: Node, event?: Event) => void) {
        this.fnNewNodeDropped = onDrop;
        this.newTabJson = json;
        this.dragStart(undefined, dragText, TabNode._fromJson(json, this.props.model, false), true, undefined, undefined);
    }

    moveTabWithDragAndDrop(node: TabNode | TabSetNode, dragText?: string) {
        this.dragStart(undefined, dragText, node, true, undefined, undefined);
    }

    addTabWithDragAndDropIndirect(dragText: string | undefined, json: IJsonTabNode, onDrop?: (node?: Node, event?: Event) => void) {
        this.fnNewNodeDropped = onDrop;
        this.newTabJson = json;

        DragDrop.instance.addGlass(this.onCancelAdd);

        this.dragDivText = dragText;
        this.dragDiv = this.currentDocument!.createElement("div");
        this.dragDiv.class = this.getclass(CLASSES.FLEXLAYOUT__DRAG_RECT);
        this.dragDiv.addEventListener("mousedown", this.onDragDivMouseDown);
        this.dragDiv.addEventListener("touchstart", this.onDragDivMouseDown, { passive: false });

        this.dragRectRender(this.dragDivText, undefined, this.newTabJson, () => {
            if (this.dragDiv) {
                // now it's been rendered into the dom it can be centered
                this.dragDiv.style.visibility = "visible";
                const domRect = this.dragDiv.getBoundingClientRect();
                const r = new Rect(0, 0, domRect?.width, domRect?.height);
                r.centerInRect(this.state.rect);
                this.dragDiv.setAttribute("data-layout-path", "/drag-rectangle");
                this.dragDiv.style.left = r.x + "px";
                this.dragDiv.style.top = r.y + "px";
            }
        });

        const rootdiv = this.selfRef.current;
        rootdiv!.appendChild(this.dragDiv);
    }


    onCancelAdd = () => {
        const rootdiv = this.selfRef.current;
        if (rootdiv && this.dragDiv) {
            rootdiv.removeChild(this.dragDiv);
        }
        this.dragDiv = undefined;
        this.hidePortal();
        if (this.fnNewNodeDropped != null) {
            this.fnNewNodeDropped();
            this.fnNewNodeDropped = undefined;
        }

        try {
            this.customDrop?.invalidated?.();
        } catch (e) {
            console.error(e);
        }

        DragDrop.instance.hideGlass();
        this.newTabJson = undefined;
        this.customDrop = undefined;
    };


    onCancelDrag = (wasDragging: boolean) => {
        if (wasDragging) {
            const rootdiv = this.selfRef.current;

            const outlineDiv = this.outlineDiv;
            if (rootdiv && outlineDiv) {
                try {
                    rootdiv.removeChild(outlineDiv);
                } catch (e) {
                    // ignore error
                }
            }

            const dragDiv = this.dragDiv;
            if (rootdiv && dragDiv) {
                try {
                    rootdiv.removeChild(dragDiv);
                } catch (e) {
                    // ignore error
                }
            }

            this.dragDiv = undefined;
            this.hidePortal();
            this.setState({ showEdges: false });
            if (this.fnNewNodeDropped != null) {
                this.fnNewNodeDropped();
                this.fnNewNodeDropped = undefined;
            }

            try {
                this.customDrop?.invalidated?.();
            } catch (e) {
                console.error(e);
            }

            DragDrop.instance.hideGlass();
            this.newTabJson = undefined;
            this.customDrop = undefined;
        }
        this.setState({ showHiddenBorder: DockLocation.CENTER });
    };


    onDragDivMouseDown = (event: Event) => {
        event.preventDefault();
        this.dragStart(event, this.dragDivText, TabNode._fromJson(this.newTabJson, this.props.model, false), true, undefined, undefined);
    };


    dragStart = (
        event: Event | MouseEvent<HTMLDivElement, MouseEvent> | TouchEvent<HTMLDivElement> | DragEvent<HTMLDivElement> | undefined,
        dragDivText: string | undefined,
        node: Node & IDraggable,
        allowDrag: boolean,
        onClick?: (event: Event) => void,
        onDoubleClick?: (event: Event) => void,
    ) => {
        if (!allowDrag) {
            DragDrop.instance.startDrag(event, undefined, undefined, undefined, undefined, onClick, onDoubleClick, this.currentDocument, this.selfRef.current ?? undefined);
        } else {
            this.dragNode = JSXElement;
            this.dragDivText = dragDivText;
            DragDrop.instance.startDrag(event, this.onDragStart, this.onDragMove, this.onDragEnd, this.onCancelDrag, onClick, onDoubleClick, this.currentDocument, this.selfRef.current ?? undefined);
        }
    };


    dragRectRender = (text: string | undefined, node?: Node, json?: IJsonTabNode, onRendered?: () => void) => {
        let content: JSXElement | undefined;

        if (text !== undefined) {
            content = <div style={{ whiteSpace: "pre" }}>{text.replace("<br>", "\n")}</div>;
        } else {
            if (node && node instanceof TabNode) {
                content = <TabButtonStamp node={node} layout={this} iconFactory={this.props.iconFactory} titleFactory={this.props.titleFactory} />;
            }
        }

        if (this.props.onRenderDragRect !== undefined) {
            const customContent = this.props.onRenderDragRect(content, node, json);
            if (customContent !== undefined) {
                content = customContent;
            }
        }

        // hide div until the render is complete
        this.dragRectRendered = false;
        const dragDiv = this.dragDiv;
        if (dragDiv) {
            dragDiv.style.visibility = "hidden";
            this.showPortal(
                <DragRectRenderWrapper
                    // wait for it to be rendered
                    onRendered={() => {
                        this.dragRectRendered = true;
                        onRendered?.();
                    }}
                >
                    {content}
                </DragRectRenderWrapper>,
                dragDiv,
            );
        }
    };


    showPortal = (control: JSXElement | undefined, element: HTMLElement) => {
        const portal = createPortal(control, element) as ReactPortal;
        this.setState({ portal });
    };


    hidePortal = () => {
        this.setState({ portal: undefined });
    };


    onDragStart = () => {
        this.dropInfo = undefined;
        this.customDrop = undefined;
        const rootdiv = this.selfRef.current;
        this.outlineDiv = this.currentDocument!.createElement("div");
        this.outlineDiv.class = this.getclass(CLASSES.FLEXLAYOUT__OUTLINE_RECT);
        this.outlineDiv.style.visibility = "hidden";
        if (rootdiv) {
            rootdiv.appendChild(this.outlineDiv);
        }

        if (this.dragDiv == null) {
            this.dragDiv = this.currentDocument!.createElement("div");
            this.dragDiv.class = this.getclass(CLASSES.FLEXLAYOUT__DRAG_RECT);
            this.dragDiv.setAttribute("data-layout-path", "/drag-rectangle");
            this.dragRectRender(this.dragDivText, this.dragNode, this.newTabJson);

            if (rootdiv) {
                rootdiv.appendChild(this.dragDiv);
            }
        }
        // add edge indicators
        if (this.props.model.getMaximizedTabset() === undefined) {
            this.setState({ showEdges: this.props.model.isEnableEdgeDock() });
        }

        if (this.dragNode && this.outlineDiv && this.dragNode instanceof TabNode && this.dragNode.getTabRect() !== undefined) {
            this.dragNode.getTabRect()?.positionElement(this.outlineDiv);
        }
        this.firstMove = true;

        return true;
    };
    onDragMove = (event: MouseEvent<Element>) => {
        if (this.firstMove === false) {
            const speed = this.props.model._getAttribute("tabDragSpeed") as number;
            if (this.outlineDiv) {
                this.outlineDiv.style.transition = `top ${speed}s, left ${speed}s, width ${speed}s, height ${speed}s`;
            }
        }
        this.firstMove = false;
        const clientRect = this.selfRef.current?.getBoundingClientRect();
        const pos = {
            x: event.clientX - (clientRect?.left ?? 0),
            y: event.clientY - (clientRect?.top ?? 0),
        };

        this.checkForBorderToShow(pos.x, pos.y);

        // keep it between left & right
        const dragRect = this.dragDiv?.getBoundingClientRect() ?? new DOMRect(0, 0, 100, 100);
        let newLeft = pos.x - dragRect.width / 2;
        if (newLeft + dragRect.width > (clientRect?.width ?? 0)) {
            newLeft = (clientRect?.width ?? 0) - dragRect.width;
        }
        newLeft = Math.max(0, newLeft);

        if (this.dragDiv) {
            this.dragDiv.style.left = newLeft + "px";
            this.dragDiv.style.top = pos.y + 5 + "px";
            if (this.dragRectRendered && this.dragDiv.style.visibility === "hidden") {
                // make visible once the drag rect has been rendered
                this.dragDiv.style.visibility = "visible";
            }
        }

        const dropInfo = this.props.model._findDropTargetNode(this.dragNode!, pos.x, pos.y);
        if (dropInfo) {
            if (this.props.onTabDrag) {
                this.handleCustomTabDrag(dropInfo, pos, event);
            } else {
                this.dropInfo = dropInfo;
                if (this.outlineDiv) {
                    this.outlineDiv.class = this.getclass(dropInfo.class);
                    dropInfo.rect.positionElement(this.outlineDiv);
                    this.outlineDiv.style.visibility = "visible";
                }
            }
        }
    };
    onDragEnd = (event: Event) => {
        const rootdiv = this.selfRef.current;
        if (rootdiv) {
            if (this.outlineDiv) {
                rootdiv.removeChild(this.outlineDiv);
            }
            if (this.dragDiv) {
                rootdiv.removeChild(this.dragDiv);
            }
        }
        this.dragDiv = undefined;
        this.hidePortal();

        this.setState({ showEdges: false });
        DragDrop.instance.hideGlass();

        if (this.dropInfo) {
            if (this.customDrop) {
                this.newTabJson = undefined;

                try {
                    const { callback, dragging, over, x, y, location } = this.customDrop;
                    callback(dragging, over, x, y, location);
                    if (this.fnNewNodeDropped != null) {
                        this.fnNewNodeDropped();
                        this.fnNewNodeDropped = undefined;
                    }
                } catch (e) {
                    console.error(e);
                }
            } else if (this.newTabJson !== undefined) {
                const newNode = this.doAction(Actions.addNode(this.newTabJson, this.dropInfo.node.getId(), this.dropInfo.location, this.dropInfo.index));

                if (this.fnNewNodeDropped != null) {
                    this.fnNewNodeDropped(newNode, event);
                    this.fnNewNodeDropped = undefined;
                }
                this.newTabJson = undefined;
            } else if (this.dragNode !== undefined) {
                this.doAction(Actions.moveNode(this.dragNode.getId(), this.dropInfo.node.getId(), this.dropInfo.location, this.dropInfo.index));
            }
        }
        this.setState({ showHiddenBorder: DockLocation.CENTER });
    };
    private handleCustomTabDrag(dropInfo: DropInfo, pos: { x: number; y: number }, event: MouseEvent<Element, MouseEvent>) {
        let invalidated = this.customDrop?.invalidated;
        const currentCallback = this.customDrop?.callback;
        this.customDrop = undefined;

        const dragging = this.newTabJson || (this.dragNode instanceof TabNode ? this.dragNode : undefined);
        if (dragging && (dropInfo.node instanceof TabSetNode || dropInfo.node instanceof BorderNode) && dropInfo.index === -1) {
            const selected = dropInfo.node.getSelectedNode() as TabNode | undefined;
            const tabRect = selected?.getRect();

            if (selected && tabRect?.contains(pos.x, pos.y)) {
                let customDrop: ICustomDropDestination | undefined = undefined;

                try {
                    const dest = this.onTabDrag(dragging, selected, pos.x - tabRect.x, pos.y - tabRect.y, dropInfo.location, () => this.onDragMove(event));

                    if (dest) {
                        customDrop = {
                            rect: new Rect(dest.x + tabRect.x, dest.y + tabRect.y, dest.width, dest.height),
                            callback: dest.callback,
                            invalidated: dest.invalidated,
                            dragging: dragging,
                            over: selected,
                            x: pos.x - tabRect.x,
                            y: pos.y - tabRect.y,
                            location: dropInfo.location,
                            cursor: dest.cursor,
                        };
                    }
                } catch (e) {
                    console.error(e);
                }

                if (customDrop?.callback === currentCallback) {
                    invalidated = undefined;
                }

                this.customDrop = customDrop;
            }
        }

        this.dropInfo = dropInfo;
        if (this.outlineDiv) {
            this.outlineDiv.class = this.getclass(this.customDrop ? CLASSES.FLEXLAYOUT__OUTLINE_RECT : dropInfo.class);
            if (this.customDrop) {
                this.customDrop.rect.positionElement(this.outlineDiv);
            } else {
                dropInfo.rect.positionElement(this.outlineDiv);
            }
        }

        DragDrop.instance.setGlassCursorOverride(this.customDrop?.cursor);
        if (this.outlineDiv) {
            this.outlineDiv.style.visibility = "visible";
        }

        try {
            invalidated?.();
        } catch (e) {
            console.error(e);
        }
    }
    onDragEnter(event: DragEvent<HTMLDivElement>) {
        // DragDrop keeps track of number of dragenters minus the number of
        // dragleaves. Only start a new drag if there isn't one already.
        if (DragDrop.instance.isDragging()) return;
        const drag = this.props.onExternalDrag!(event);
        if (drag) {
            // Mimic addTabWithDragAndDrop, but pass in DragEvent
            this.fnNewNodeDropped = drag.onDrop;
            this.newTabJson = drag.json;
            this.dragStart(event, drag.dragText, TabNode._fromJson(drag.json, this.props.model, false), true, undefined, undefined);
        }
    }
    checkForBorderToShow(x: number, y: number) {
        const r = this.props.model._getOuterInnerRects().outer;
        const c = r.getCenter();
        const margin = this.edgeRectWidth;
        const offset = this.edgeRectLength / 2;

        let overEdge = false;
        if (this.props.model.isEnableEdgeDock() && this.state.showHiddenBorder === DockLocation.CENTER) {
            if ((y > c.y - offset && y < c.y + offset) || (x > c.x - offset && x < c.x + offset)) {
                overEdge = true;
            }
        }

        let location = DockLocation.CENTER;
        if (!overEdge) {
            if (x <= r.x + margin) {
                location = DockLocation.LEFT;
            } else if (x >= r.getRight() - margin) {
                location = DockLocation.RIGHT;
            } else if (y <= r.y + margin) {
                location = DockLocation.TOP;
            } else if (y >= r.getBottom() - margin) {
                location = DockLocation.BOTTOM;
            }
        }

        if (location !== this.state.showHiddenBorder) {
            this.setState({ showHiddenBorder: location });
        }
    }
    maximize(tabsetNode: TabSetNode) {
        this.doAction(Actions.maximizeToggle(tabsetNode.getId()));
    }
    customizeTab(tabNode: TabNode, renderValues: ITabRenderValues) {
        if (this.props.onRenderTab) {
            this.props.onRenderTab(tabNode, renderValues);
        }
    }
    customizeTabSet(tabSetNode: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) {
        if (this.props.onRenderTabSet) {
            this.props.onRenderTabSet(tabSetNode, renderValues);
        }
    }
    i18nName(id: I18nLabel, param?: string) {
        let message;
        if (this.props.i18nMapper) {
            message = this.props.i18nMapper(id, param);
        }
        if (message === undefined) {
            message = id + (param === undefined ? "" : param);
        }
        return message;
    }
    getOnRenderFloatingTabPlaceholder() {
        return this.props.onRenderFloatingTabPlaceholder;
    }
    getShowOverflowMenu() {
        return this.props.onShowOverflowMenu;
    }
    getTabSetPlaceHolderCallback() {
        return this.props.onTabSetPlaceHolder;
    }
    showContextMenu(node: TabNode | TabSetNode | BorderNode, event: MouseEvent) {
        if (this.props.onContextMenu) {
            this.props.onContextMenu(node, event);
        }
    }
    auxMouseClick(node: TabNode | TabSetNode | BorderNode, event: MouseEvent) {
        if (this.props.onAuxMouseClick) {
            this.props.onAuxMouseClick(node, event);
        }
    }
}

