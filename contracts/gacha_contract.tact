import "@stdlib/deploy";

message OpenBox {
    queryId: Int as uint64;
}

contract GachaContract with Deployable {
    owner: Address;
    boxPrice: Int as coins = ton("1.0");

    init(owner: Address) {
        self.owner = owner;
    }

    receive(msg: OpenBox) {
        let ctx: Context = context();
        // Gelen TON miktarının kutu fiyatını karşıladığını kontrol et
        require(ctx.value >= self.boxPrice, "Insufficient TON to open box");
        
        // Kasaya (Owner) parayı gönder
        send(SendParameters{
            to: self.owner,
            bounce: false,
            value: ctx.value - ton("0.05"), // Ağ ücretini düş
            mode: SendIgnoreErrors
        });

        // Burada Backend'e event fırlatılır ve NFT basım işlemi (Mint) tetiklenir
    }
}