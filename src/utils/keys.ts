import type{ProjectId}from'../types/task';export const makeKey=(project:ProjectId,n:number)=>`${project}-${n}`;
