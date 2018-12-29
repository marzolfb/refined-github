import select from 'select-dom';

const dgraph = require("dgraph-js-http");

// Create a client stub.
function newClientStub() {
    return new dgraph.DgraphClientStub(
        // addr: optional, default: "http://localhost:8080"
        "http://localhost:8080",
    );
}

// Create a client.
function newClient(clientStub) {
    return new dgraph.DgraphClient(clientStub);
}

function ownerAndRepo(inputText) {
    const inputParts = inputText.split('/');
    if (inputParts.length !== 2) throw "Must be in 'owner/repo' format"; 
    const owner = inputParts[0]; 
    const repo = inputParts[1];
    return {owner, repo};
}

async function ownerNode(txn, ownerName) {
    let ownerNode = {
        name: ownerName
    }

    let query = `query owners($ownerName: string) {
        owners(func: eq(name, $ownerName)) @filter(NOT has(org))
        {
            uid
        }
    }`;
    let vars = { $ownerName: ownerName };
    let res = await txn.queryWithVars(query, vars);
    let owners = res.data.owners;
    if (owners.length > 0) ownerNode["uid"] = owners[0].uid;

    return ownerNode;
}

async function repoNode(txn, repoName) {
    let repoNode = {
        name: repoName
    }

    let query = `query repos($repoName: string) {
        repos(func: eq(name, $repoName)) @filter(has(org))
        {
            uid
        }
    }`;
    let vars = { $repoName: repoName };
    let res = await txn.queryWithVars(query, vars);
    let repos = res.data.repos;
    if (repos.length > 0) repoNode["uid"] = repos[0].uid;

    return repoNode;
}

async function addRepo(dgraphClient, owner, repo) {
    // Create a new transaction.
    const txn = dgraphClient.newTxn();
    try {
        const similarTo = select("#similar-to").value
        const {owner: similarToOwner, repo: similarToRepo} = ownerAndRepo(similarTo);

        let addRepoNode = await repoNode(txn, repo);
        addRepoNode["org"] = await ownerNode(txn, owner);;
        
        let similarToRepoNode = await repoNode(txn, similarToRepo);
        similarToRepoNode["org"] = await ownerNode(txn, similarToOwner);

        addRepoNode["similar_to"] = similarToRepoNode
        
        await txn.mutate({ setJson: addRepoNode });

        await txn.commit();
    } finally {
        await txn.discard();
    }
}

if (select.exists('.btn-add-repo')) {
    select('.btn-add-repo').addEventListener('click', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const owner = urlParams.get('owner');
        const repo = urlParams.get('repo');
        const dgraphClientStub = newClientStub();
        const dgraphClient = newClient(dgraphClientStub);

        addRepo(dgraphClient, owner, repo).then(() => {
            console.log("\nDONE!");
            close();
        }).catch((e) => {
            console.log("ERROR: ", e);
            select("#addrepomsgs").append(e);
        });

        
    });
}


