export declare const reparentChildren: <T extends Element>(srcElements: T[], newParent: Element, prepareCallback?: ((el: T) => void | ((el: T) => void)) | undefined) => (() => Element[]);
