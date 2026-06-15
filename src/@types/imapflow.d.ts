declare module "imapflow" {
  export interface EmailAddress {
    address?: string;
    name?: string;
  }

  export interface Envelope {
    from?: EmailAddress[];
    subject?: string;
  }

  export interface MessagePartInfo {
    partId?: string;
    type: string;
    subtype?: string;
    dispositionParameters?: {
      filename?: string;
    };
    childNodes?: MessagePartInfo[];
  }

  export interface MessageObject {
    envelope: Envelope;
    bodyStructure?: MessagePartInfo;
  }

  export interface DownloadStream {
    content: AsyncIterable<Buffer | string>;
  }

  export class ImapFlow {
    constructor(options: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
      logger: boolean;
    });
    connect(): Promise<void>;
    getMailboxLock(
      mailbox: string,
    ): Promise<{ release: () => void }>;
    fetch(
      query: string,
      options: { envelope: boolean; bodyStructure: boolean; source: boolean },
    ): AsyncIterable<MessageObject>;
    download(partId: string): Promise<DownloadStream>;
    logout(): Promise<void>;
  }
}
