export interface QuizLeadAnswers {
    objectType?: string;
    area?: string;
    systems?: string[];
}

export interface TelegramLead {
    name: string;
    phone: string;
    direction: string;
    message?: string;
    pathname: string;
    quizAnswers?: QuizLeadAnswers;
}
