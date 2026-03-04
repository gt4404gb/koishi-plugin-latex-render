import { Context, Schema } from 'koishi';
export declare const name = "latex-render";
export declare const inject: string[];
export interface Config {
    /** 图片宽度 */
    width?: number;
    /** 背景色 */
    backgroundColor?: string;
    /** 文字颜色 */
    textColor?: string;
    /** 调试模式 */
    debug?: boolean;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
