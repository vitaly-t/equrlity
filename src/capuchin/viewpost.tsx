import * as React from "react";
import * as ReactDOM from "react-dom";
import {PostView} from "../lib/postview";
import * as Dbt from "../lib/datatypes";

// injected as global by server
declare var post : Dbt.Post;  
// never get here - gawd know why
console.log("post: "+JSON.stringify(post));
let elem = document.getElementById('app');
ReactDOM.render(<div>postId</div>, elem);
